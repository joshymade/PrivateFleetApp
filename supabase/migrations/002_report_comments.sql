-- Report description + Feed reply comments
-- - damage_reports.report_comment: driver's multi-line description at upload
--   (renames unused notes; applies to trailer + tractor / "truck" reports)
-- - damage_report_comments: Feed replies on any damage report
--
-- Truck reports use existing asset_type = 'tractor' (no separate truck table).
-- Apply after 001_init.sql (already live on Cloud).

-- ---------------------------------------------------------------------------
-- Report comment on damage_reports (upload-time description)
-- ---------------------------------------------------------------------------
alter table public.damage_reports
  rename column notes to report_comment;

comment on column public.damage_reports.report_comment is
  'Driver description of the damage for the uploaded photo(s); not a Feed reply.';

-- View was created with SELECT dr.* while the column was still named notes;
-- recreate so the output column is report_comment (not notes).
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

-- ---------------------------------------------------------------------------
-- Feed reply comments
-- ---------------------------------------------------------------------------
create table public.damage_report_comments (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint damage_report_comments_body_nonempty check (
    char_length(trim(body)) >= 1
  )
);

create index if not exists damage_report_comments_report_idx
  on public.damage_report_comments (damage_report_id, created_at asc);

create index if not exists damage_report_comments_author_idx
  on public.damage_report_comments (author_id);

comment on table public.damage_report_comments is
  'Feed reply comments on damage reports (distinct from report_comment).';

-- Grants (Data API); default privileges also cover new tables, but be explicit.
grant select, insert, update, delete on public.damage_report_comments
  to authenticated, service_role;
grant select on public.damage_report_comments to anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.damage_report_comments enable row level security;

-- Fleet can read replies on Feed reports (same visibility as damage_reports).
drop policy if exists "damage_report_comments_select_authenticated"
  on public.damage_report_comments;
create policy "damage_report_comments_select_authenticated"
  on public.damage_report_comments for select to authenticated
  using (true);

-- Any authenticated fleet member can reply as themselves (drivers + Safety/Admin).
drop policy if exists "damage_report_comments_insert_own"
  on public.damage_report_comments;
create policy "damage_report_comments_insert_own"
  on public.damage_report_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
    )
  );

-- Authors can edit their own reply body (cannot reassign author/report).
drop policy if exists "damage_report_comments_update_own"
  on public.damage_report_comments;
create policy "damage_report_comments_update_own"
  on public.damage_report_comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- Authors can delete own; Admin can delete any.
drop policy if exists "damage_report_comments_delete_own_or_admin"
  on public.damage_report_comments;
create policy "damage_report_comments_delete_own_or_admin"
  on public.damage_report_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (select public.is_admin())
  );
