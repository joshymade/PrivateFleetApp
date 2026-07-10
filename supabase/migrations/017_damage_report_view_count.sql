-- Page view counter for damage report detail (/feed/[reportId]).
-- Distinct from damage_notices ("Notice" / Safety viewed).
-- Counts every visit/open of the detail page (not unique viewers).

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------
alter table public.damage_reports
  add column if not exists view_count integer not null default 0;

alter table public.damage_reports
  drop constraint if exists damage_reports_view_count_nonnegative;

alter table public.damage_reports
  add constraint damage_reports_view_count_nonnegative
  check (view_count >= 0);

comment on column public.damage_reports.view_count is
  'Page view count for the damage report detail page; incremented on each open. Not related to damage_notices.';

-- ---------------------------------------------------------------------------
-- Feed / search view — include view_count
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
-- RPC: increment once per detail page open
-- SECURITY DEFINER — no general UPDATE policy on damage_reports; body checks auth.
-- ---------------------------------------------------------------------------
create or replace function public.increment_damage_report_view(p_report_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  update public.damage_reports
  set view_count = view_count + 1
  where id = p_report_id
  returning view_count into new_count;

  if new_count is null then
    raise exception 'Report not found';
  end if;

  return new_count;
end;
$$;

comment on function public.increment_damage_report_view(uuid) is
  'Increments damage_reports.view_count by 1 for an authenticated viewer who can open the report detail page.';

revoke execute on function public.increment_damage_report_view(uuid)
  from public, anon;
grant execute on function public.increment_damage_report_view(uuid)
  to authenticated, service_role;
