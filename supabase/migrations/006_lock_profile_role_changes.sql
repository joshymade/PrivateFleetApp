-- Default signup role = driver; only admins may change profiles.role.
-- Defense in depth: signup trigger ignores client metadata for role,
-- BEFORE UPDATE trigger rejects non-admin role changes, and own-profile
-- RLS WITH CHECK keeps role immutable for non-admins.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_driver_id text;
  meta_full_name text;
begin
  meta_driver_id := nullif(trim(coalesce(new.raw_user_meta_data->>'driver_id', '')), '');
  meta_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  -- Never trust raw_user_meta_data->>'role' — always insert driver.
  if meta_driver_id is null then
    meta_driver_id := 'tmp-' || replace(new.id::text, '-', '');
  end if;

  begin
    insert into public.profiles (id, driver_id, email, full_name, role)
    values (
      new.id,
      meta_driver_id,
      new.email,
      meta_full_name,
      'driver'
    );
  exception
    when unique_violation then
      raise exception 'driver_id already in use'
        using errcode = '23505';
  end;

  return new;
end;
$$;

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for Dashboard SQL / service_role bootstrap.
    if (select auth.uid()) is not null and not (select public.is_admin()) then
      raise exception 'Only admins can change roles'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_change on public.profiles;
create trigger profiles_enforce_role_change
  before update of role on public.profiles
  for each row execute function public.enforce_profile_role_change();

-- Own-profile updates may change name/email/driver_id, but not role.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (
      select p.role from public.profiles p where p.id = (select auth.uid())
    )
  );

-- Admins may update any profile including role (unchanged intent).
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_profile_role_change() from public, anon, authenticated;
