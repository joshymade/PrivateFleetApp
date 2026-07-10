-- Safety/admin accounts do not keep a company Driver ID.
-- Safety may only read damage reports that were referred via safety_inbox_items
-- (and related photos). Comments are hidden from Safety at RLS as well.

-- ---------------------------------------------------------------------------
-- Clear driver_id when promoting to safety/admin
-- ---------------------------------------------------------------------------
create or replace function public.clear_driver_id_for_non_drivers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('safety', 'admin') then
    new.driver_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_clear_driver_id_non_drivers on public.profiles;
create trigger profiles_clear_driver_id_non_drivers
  before insert or update of role, driver_id on public.profiles
  for each row
  execute function public.clear_driver_id_for_non_drivers();

revoke execute on function public.clear_driver_id_for_non_drivers()
  from public, anon;
grant execute on function public.clear_driver_id_for_non_drivers()
  to authenticated, service_role;

-- Backfill existing safety/admin rows.
update public.profiles
set driver_id = null
where role in ('safety', 'admin')
  and driver_id is not null;

-- ---------------------------------------------------------------------------
-- Damage reports: Safety sees referred reports only; drivers/admin see all
-- ---------------------------------------------------------------------------
drop policy if exists "damage_reports_select_authenticated" on public.damage_reports;
create policy "damage_reports_select_authenticated"
  on public.damage_reports for select to authenticated
  using (
    not (select public.is_safety())
    or exists (
      select 1
      from public.safety_inbox_items si
      where si.damage_report_id = id
    )
  );

-- Photos follow the same referral scope for Safety.
drop policy if exists "damage_report_photos_select_authenticated"
  on public.damage_report_photos;
create policy "damage_report_photos_select_authenticated"
  on public.damage_report_photos for select to authenticated
  using (
    not (select public.is_safety())
    or exists (
      select 1
      from public.safety_inbox_items si
      where si.damage_report_id = damage_report_id
    )
  );

-- Safety does not participate in the driver reply thread.
drop policy if exists "damage_report_comments_select_authenticated"
  on public.damage_report_comments;
create policy "damage_report_comments_select_authenticated"
  on public.damage_report_comments for select to authenticated
  using (not (select public.is_safety()));

drop policy if exists "damage_report_comments_insert_own"
  on public.damage_report_comments;
create policy "damage_report_comments_insert_own"
  on public.damage_report_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not (select public.is_safety())
    and exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
    )
  );
