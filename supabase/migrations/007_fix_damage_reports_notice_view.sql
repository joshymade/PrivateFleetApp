-- Refresh damage_reports_with_notice_count after notes → report_comment rename.
-- Postgres freezes SELECT * column names at CREATE VIEW time, so the live view
-- still exposed report_comment AS notes and broke Feed selects of report_comment.

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
