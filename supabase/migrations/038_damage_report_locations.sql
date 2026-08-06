-- Report-level damage location tags + per-photo location.
-- Stable keys (e.g. front_of_trailer); labels live in app code.

alter table public.damage_reports
  add column if not exists damage_locations text[] not null default '{}';

comment on column public.damage_reports.damage_locations is
  'Distinct trailer damage area tags (stable keys); often derived from photo locations.';

create index if not exists damage_reports_damage_locations_gin
  on public.damage_reports using gin (damage_locations);

alter table public.damage_report_photos
  add column if not exists damage_location text;

comment on column public.damage_report_photos.damage_location is
  'Stable damage location key for this photo; required for new trailer photos.';

create index if not exists damage_report_photos_damage_location_idx
  on public.damage_report_photos (damage_location)
  where damage_location is not null;

-- Refresh Feed view so selects can include damage_locations.
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
  dr.damage_locations,
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
