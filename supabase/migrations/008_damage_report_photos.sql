-- Multi-photo damage reports: child rows under one damage_reports parent.
-- Parent damage_reports.r2_key / r2_url remain the cover (first) photo for Feed/list.

create table public.damage_report_photos (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  r2_key text not null unique,
  r2_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint damage_report_photos_sort_nonneg check (sort_order >= 0)
);

create index if not exists damage_report_photos_report_idx
  on public.damage_report_photos (damage_report_id, sort_order asc);

comment on table public.damage_report_photos is
  'Additional (and cover) photos for a damage report. Cover also mirrored on damage_reports.r2_*.';

-- Backfill existing single-photo reports as sort_order 0.
insert into public.damage_report_photos (
  damage_report_id,
  r2_key,
  r2_url,
  sort_order
)
select
  dr.id,
  dr.r2_key,
  dr.r2_url,
  0
from public.damage_reports dr
where not exists (
  select 1
  from public.damage_report_photos p
  where p.r2_key = dr.r2_key
);

grant select, insert, update, delete on public.damage_report_photos
  to authenticated;
grant select on public.damage_report_photos to anon;

alter table public.damage_report_photos enable row level security;

drop policy if exists "damage_report_photos_select_authenticated"
  on public.damage_report_photos;
create policy "damage_report_photos_select_authenticated"
  on public.damage_report_photos for select to authenticated
  using (true);

-- Drivers may insert photos only for reports they own.
drop policy if exists "damage_report_photos_insert_own_report"
  on public.damage_report_photos;
create policy "damage_report_photos_insert_own_report"
  on public.damage_report_photos for insert to authenticated
  with check (
    (select public.is_driver())
    and exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
        and dr.reported_by = (select auth.uid())
    )
  );

-- Own photos: update/delete; Admin may delete any.
drop policy if exists "damage_report_photos_update_own_report"
  on public.damage_report_photos;
create policy "damage_report_photos_update_own_report"
  on public.damage_report_photos for update to authenticated
  using (
    exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
        and dr.reported_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
        and dr.reported_by = (select auth.uid())
    )
  );

drop policy if exists "damage_report_photos_delete_own_or_admin"
  on public.damage_report_photos;
create policy "damage_report_photos_delete_own_or_admin"
  on public.damage_report_photos for delete to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
        and dr.reported_by = (select auth.uid())
    )
  );
