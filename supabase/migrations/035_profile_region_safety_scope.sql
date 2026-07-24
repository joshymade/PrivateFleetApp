-- Driver/Safety region (1–6), one-time driver lock, reporter_region snapshot,
-- Safety RLS scoped to matching region, regional + fleet safety_home_stats.

-- ---------------------------------------------------------------------------
-- profiles.region + region_locked
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists region smallint;

alter table public.profiles
  drop constraint if exists profiles_region_range;

alter table public.profiles
  add constraint profiles_region_range
  check (region is null or (region >= 1 and region <= 6));

alter table public.profiles
  add column if not exists region_locked boolean not null default false;

comment on column public.profiles.region is
  'Fleet region 1–6. Drivers set once then lock; Safety assigned by Admin; Admin may be null.';

comment on column public.profiles.region_locked is
  'When true, non-admins cannot change region. Set automatically when a driver first chooses a region.';

create index if not exists profiles_region_idx
  on public.profiles (region)
  where region is not null;

-- ---------------------------------------------------------------------------
-- damage_reports.reporter_region (snapshot at insert)
-- ---------------------------------------------------------------------------
alter table public.damage_reports
  add column if not exists reporter_region smallint;

alter table public.damage_reports
  drop constraint if exists damage_reports_reporter_region_range;

alter table public.damage_reports
  add constraint damage_reports_reporter_region_range
  check (reporter_region is null or (reporter_region >= 1 and reporter_region <= 6));

comment on column public.damage_reports.reporter_region is
  'Snapshot of the reporting driver''s profiles.region at insert time; used for Safety region scope.';

create index if not exists damage_reports_reporter_region_idx
  on public.damage_reports (reporter_region)
  where reporter_region is not null;

-- Backfill from current reporter profile region where possible.
update public.damage_reports dr
set reporter_region = p.region
from public.profiles p
where dr.reported_by = p.id
  and dr.reporter_region is null
  and p.region is not null;

-- Prefer original reporter when untagged (Anonymous Driver has no region).
update public.damage_reports dr
set reporter_region = p.region
from public.profiles p
where dr.original_reported_by = p.id
  and dr.reporter_region is null
  and p.region is not null;

create or replace function public.set_damage_report_reporter_region()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snap smallint;
begin
  select region into snap
  from public.profiles
  where id = new.reported_by;

  new.reporter_region := snap;
  return new;
end;
$$;

drop trigger if exists damage_reports_set_reporter_region on public.damage_reports;
create trigger damage_reports_set_reporter_region
  before insert on public.damage_reports
  for each row
  execute function public.set_damage_report_reporter_region();

revoke execute on function public.set_damage_report_reporter_region()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Region edit enforcement (drivers lock after first set; Safety admin-only)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_region_edits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  caller_is_admin :=
    (select auth.uid()) is null
    or (select public.is_admin());

  if new.region_locked is distinct from old.region_locked then
    if old.region_locked = true and new.region_locked = false and not caller_is_admin then
      raise exception 'Only admins can unlock region'
        using errcode = '42501';
    end if;
  end if;

  if new.region is not distinct from old.region then
    return new;
  end if;

  if caller_is_admin then
    if new.region is not null and new.role in ('driver', 'safety') then
      new.region_locked := true;
    elsif new.region is null then
      -- Clearing region unlocks so a driver can choose again after admin reset.
      new.region_locked := false;
    end if;
    return new;
  end if;

  -- Non-admin (own profile updates)
  if old.role = 'safety' then
    raise exception 'Only admins can set Safety region. Contact admin.'
      using errcode = '42501';
  end if;

  if old.role = 'driver' then
    if old.region_locked then
      raise exception 'Region is locked. Contact admin.'
        using errcode = '42501';
    end if;
    if new.region is null then
      raise exception 'Choose a region (1–6).';
    end if;
    new.region_locked := true;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_region_edits on public.profiles;
create trigger profiles_enforce_region_edits
  before update of region, region_locked on public.profiles
  for each row
  execute function public.enforce_profile_region_edits();

revoke execute on function public.enforce_profile_region_edits()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers for Safety region RLS (SECURITY DEFINER — avoid policy recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_region()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select region
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function public.report_in_safety_region(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.damage_reports dr
    where dr.id = p_report_id
      and dr.reporter_region is not null
      and dr.reporter_region = (select public.current_profile_region())
  );
$$;

revoke execute on function public.current_profile_region()
  from public, anon;
revoke execute on function public.report_in_safety_region(uuid)
  from public, anon;

grant execute on function public.current_profile_region()
  to authenticated, service_role;
grant execute on function public.report_in_safety_region(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: Safety sees regional damage reports (replaces referral-only scope)
-- Drivers/admin unchanged (fleet-readable).
-- ---------------------------------------------------------------------------
drop policy if exists "damage_reports_select_authenticated" on public.damage_reports;
create policy "damage_reports_select_authenticated"
  on public.damage_reports for select to authenticated
  using (
    not (select public.is_safety())
    or (select public.report_in_safety_region(id))
  );

drop policy if exists "damage_report_photos_select_authenticated"
  on public.damage_report_photos;
create policy "damage_report_photos_select_authenticated"
  on public.damage_report_photos for select to authenticated
  using (
    not (select public.is_safety())
    or (select public.report_in_safety_region(damage_report_id))
  );

-- Safety inbox: Safety only sees referrals whose report is in their region.
-- Drivers still see items they sent; Admin sees all.
drop policy if exists "safety_inbox_select" on public.safety_inbox_items;
create policy "safety_inbox_select"
  on public.safety_inbox_items for select to authenticated
  using (
    sent_by = (select auth.uid())
    or (select public.is_admin())
    or (
      (select public.is_safety())
      and (select public.report_in_safety_region(damage_report_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Feed view: include reporter_region
-- ---------------------------------------------------------------------------
drop view if exists public.damage_reports_with_notice_count;

create view public.damage_reports_with_notice_count
with (security_invoker = true)
as
select
  dr.id,
  dr.asset_type,
  dr.asset_number,
  dr.driver_id,
  dr.reported_by,
  dr.original_reported_by,
  dr.reporter_region,
  dr.load_id,
  dr.route_number,
  dr.latitude,
  dr.longitude,
  dr.captured_at,
  dr.r2_key,
  dr.r2_url,
  dr.report_comment,
  dr.view_count,
  dr.created_at,
  coalesce(n.notice_count, 0)::int as notice_count
from public.damage_reports dr
left join (
  select damage_report_id, count(*)::int as notice_count
  from public.damage_notices
  group by damage_report_id
) n on n.damage_report_id = dr.id;

grant select on public.damage_reports_with_notice_count
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- safety_home_stats: region + fleet aggregates
-- ---------------------------------------------------------------------------
create or replace function public.safety_home_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_region smallint;
  region_total integer := 0;
  region_pending integer := 0;
  region_24h integer := 0;
  region_30d integer := 0;
  fleet_total integer;
  fleet_pending integer;
  fleet_24h integer;
  fleet_30d integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select role, region into caller_role, caller_region
  from public.profiles
  where id = (select auth.uid());

  if caller_role is distinct from 'safety'
     and caller_role is distinct from 'admin' then
    raise exception 'Not authorized';
  end if;

  select count(*)::integer into fleet_total from public.damage_reports;

  select count(*)::integer into fleet_pending
  from public.safety_inbox_items
  where status = 'pending';

  select count(*)::integer into fleet_24h
  from public.damage_reports
  where created_at >= (now() - interval '24 hours');

  select count(*)::integer into fleet_30d
  from public.damage_reports
  where created_at >= (now() - interval '30 days');

  if caller_region is not null then
    select count(*)::integer into region_total
    from public.damage_reports
    where reporter_region = caller_region;

    select count(*)::integer into region_pending
    from public.safety_inbox_items si
    join public.damage_reports dr on dr.id = si.damage_report_id
    where si.status = 'pending'
      and dr.reporter_region = caller_region;

    select count(*)::integer into region_24h
    from public.damage_reports
    where reporter_region = caller_region
      and created_at >= (now() - interval '24 hours');

    select count(*)::integer into region_30d
    from public.damage_reports
    where reporter_region = caller_region
      and created_at >= (now() - interval '30 days');
  end if;

  return jsonb_build_object(
    'region', caller_region,
    'region_total', region_total,
    'region_pending', region_pending,
    'region_reports_24h', region_24h,
    'region_reports_30d', region_30d,
    'fleet_total', fleet_total,
    'fleet_pending', fleet_pending,
    'fleet_reports_24h', fleet_24h,
    'fleet_reports_30d', fleet_30d,
    -- Legacy aliases (region for safety; fleet for admin without region)
    'total_reports',
    case
      when caller_role = 'safety' then region_total
      else fleet_total
    end,
    'pending_review',
    case
      when caller_role = 'safety' then region_pending
      else fleet_pending
    end,
    'reports_24h',
    case
      when caller_role = 'safety' then region_24h
      else fleet_24h
    end,
    'reports_30d',
    case
      when caller_role = 'safety' then region_30d
      else fleet_30d
    end
  );
end;
$$;

comment on function public.safety_home_stats() is
  'Returns region-scoped and fleet-wide damage report totals + pending inbox counts for safety/admin Home.';

revoke execute on function public.safety_home_stats()
  from public, anon;
grant execute on function public.safety_home_stats()
  to authenticated, service_role;
