-- Fix signup / Auth Dashboard user create failing with:
--   "Failed to create user: Database error creating new user"
-- Root cause: handle_new_user raised when raw_user_meta_data had no driver_id
-- (Dashboard Add user /admin/users omits metadata; app /signup sends it).
--
-- Missing driver_id → unique provisional tmp-<uuid> so profiles constraints hold.
-- Duplicate driver_id → clear unique_violation message.

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

  -- App signup always sends driver_id. Dashboard "Add user" often omits it.
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
