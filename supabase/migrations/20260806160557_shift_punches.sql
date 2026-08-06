-- Manual start/end shift punches per driver work day (local calendar date).
-- Times are wall-clock (no timezone); overnight shifts use end_time < start_time.

create table if not exists public.shift_punches (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_punches_driver_date_uidx unique (driver_id, work_date),
  constraint shift_punches_has_time check (
    start_time is not null or end_time is not null
  )
);

create index if not exists shift_punches_driver_date_idx
  on public.shift_punches (driver_id, work_date desc);

comment on table public.shift_punches is
  'Driver-entered start/end punch times for a calendar work day.';
comment on column public.shift_punches.driver_id is
  'profiles.id (= auth.uid()), not company Driver ID text.';
comment on column public.shift_punches.work_date is
  'Local calendar day the shift is attributed to (Postgres date).';
comment on column public.shift_punches.start_time is
  'Wall-clock shift start (local); null until set.';
comment on column public.shift_punches.end_time is
  'Wall-clock shift end (local); if earlier than start_time, treat as next-day end.';

alter table public.shift_punches enable row level security;

drop policy if exists "shift_punches_select_own" on public.shift_punches;
create policy "shift_punches_select_own"
  on public.shift_punches for select to authenticated
  using (driver_id = (select auth.uid()));

drop policy if exists "shift_punches_insert_own" on public.shift_punches;
create policy "shift_punches_insert_own"
  on public.shift_punches for insert to authenticated
  with check (driver_id = (select auth.uid()));

drop policy if exists "shift_punches_update_own" on public.shift_punches;
create policy "shift_punches_update_own"
  on public.shift_punches for update to authenticated
  using (driver_id = (select auth.uid()))
  with check (driver_id = (select auth.uid()));

drop policy if exists "shift_punches_delete_own" on public.shift_punches;
create policy "shift_punches_delete_own"
  on public.shift_punches for delete to authenticated
  using (driver_id = (select auth.uid()));

grant select, insert, update, delete on public.shift_punches to authenticated;
