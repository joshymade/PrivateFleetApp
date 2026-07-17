-- Feature 2: driver week prefs, load mileage/pay, ADP entries, contact requests,
-- and owner-only loads RLS.

-- ---------------------------------------------------------------------------
-- profiles: week start + off days
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists week_start_day smallint not null default 5,
  add column if not exists off_days smallint[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_week_start_day_check;
alter table public.profiles
  add constraint profiles_week_start_day_check
  check (week_start_day >= 0 and week_start_day <= 6);

alter table public.profiles
  drop constraint if exists profiles_off_days_check;
alter table public.profiles
  add constraint profiles_off_days_check
  check (
    off_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );

comment on column public.profiles.week_start_day is
  '0=Sun … 6=Sat; default 5 (Friday). Start of the driver’s work week.';
comment on column public.profiles.off_days is
  'Weekday numbers (0–6) the driver is normally off. Loads still allowed.';

-- ---------------------------------------------------------------------------
-- loads: odometer, paid miles rename, pay amount
-- ---------------------------------------------------------------------------
alter table public.loads
  rename column assigned_miles to paid_miles;

alter table public.loads
  add column if not exists starting_mileage numeric(10, 1),
  add column if not exists ending_mileage numeric(10, 1),
  add column if not exists pay_amount numeric(10, 2);

alter table public.loads
  drop constraint if exists loads_ending_mileage_gte_starting;
alter table public.loads
  add constraint loads_ending_mileage_gte_starting
  check (
    ending_mileage is null
    or starting_mileage is null
    or ending_mileage >= starting_mileage
  );

alter table public.loads
  drop constraint if exists loads_pay_amount_nonneg;
alter table public.loads
  add constraint loads_pay_amount_nonneg
  check (pay_amount is null or pay_amount >= 0);

alter table public.loads
  drop constraint if exists loads_starting_mileage_nonneg;
alter table public.loads
  add constraint loads_starting_mileage_nonneg
  check (starting_mileage is null or starting_mileage >= 0);

alter table public.loads
  drop constraint if exists loads_ending_mileage_nonneg;
alter table public.loads
  add constraint loads_ending_mileage_nonneg
  check (ending_mileage is null or ending_mileage >= 0);

comment on column public.loads.paid_miles is
  'Company-assigned / paid miles for the load (formerly assigned_miles).';
comment on column public.loads.starting_mileage is
  'Odometer at load start; required by app on create.';
comment on column public.loads.ending_mileage is
  'Odometer at load complete; required by app on complete.';
comment on column public.loads.pay_amount is
  'Dollar amount the load paid; set on/after complete.';

-- ---------------------------------------------------------------------------
-- adp_entries: manual biweekly Average Daily Pay
-- ---------------------------------------------------------------------------
create table if not exists public.adp_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  adp_amount numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  constraint adp_entries_period_order check (period_end >= period_start),
  constraint adp_entries_amount_nonneg check (adp_amount >= 0),
  constraint adp_entries_driver_period_uidx unique (driver_id, period_start)
);

create index if not exists adp_entries_driver_id_idx
  on public.adp_entries (driver_id, period_start desc);

alter table public.adp_entries enable row level security;

drop policy if exists "adp_entries_select_own" on public.adp_entries;
create policy "adp_entries_select_own"
  on public.adp_entries for select to authenticated
  using (driver_id = (select auth.uid()));

drop policy if exists "adp_entries_insert_own" on public.adp_entries;
create policy "adp_entries_insert_own"
  on public.adp_entries for insert to authenticated
  with check (driver_id = (select auth.uid()));

drop policy if exists "adp_entries_update_own" on public.adp_entries;
create policy "adp_entries_update_own"
  on public.adp_entries for update to authenticated
  using (driver_id = (select auth.uid()))
  with check (driver_id = (select auth.uid()));

drop policy if exists "adp_entries_delete_own" on public.adp_entries;
create policy "adp_entries_delete_own"
  on public.adp_entries for delete to authenticated
  using (driver_id = (select auth.uid()));

grant select, insert, update, delete on public.adp_entries to authenticated;

-- ---------------------------------------------------------------------------
-- contact_requests: general Contact form audit + email trigger path
-- ---------------------------------------------------------------------------
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  category text not null
    check (category in ('identity', 'app_issue', 'feature', 'other')),
  message text not null,
  created_at timestamptz not null default now(),
  constraint contact_requests_message_len check (char_length(message) between 1 and 4000)
);

create index if not exists contact_requests_driver_id_idx
  on public.contact_requests (driver_id, created_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests_insert_own" on public.contact_requests;
create policy "contact_requests_insert_own"
  on public.contact_requests for insert to authenticated
  with check (driver_id = (select auth.uid()));

drop policy if exists "contact_requests_select_own_or_admin" on public.contact_requests;
create policy "contact_requests_select_own_or_admin"
  on public.contact_requests for select to authenticated
  using (
    driver_id = (select auth.uid())
    or (select public.is_admin())
  );

grant select, insert on public.contact_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: load owned by current user
-- ---------------------------------------------------------------------------
create or replace function public.owns_load(p_load_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.loads l
    where l.id = p_load_id
      and l.assigned_driver_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_load(uuid) from public;
grant execute on function public.owns_load(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Loads RLS: owner-only (assigned_driver_id = auth.uid())
-- ---------------------------------------------------------------------------
drop policy if exists "loads_select_authenticated" on public.loads;
drop policy if exists "loads_select_own" on public.loads;
create policy "loads_select_own"
  on public.loads for select to authenticated
  using (assigned_driver_id = (select auth.uid()));

drop policy if exists "loads_insert_driver_or_admin" on public.loads;
drop policy if exists "loads_insert_own" on public.loads;
create policy "loads_insert_own"
  on public.loads for insert to authenticated
  with check (
    assigned_driver_id = (select auth.uid())
    and ((select public.is_driver()) or (select public.is_admin()))
  );

drop policy if exists "loads_update_driver_or_admin" on public.loads;
drop policy if exists "loads_update_own" on public.loads;
create policy "loads_update_own"
  on public.loads for update to authenticated
  using (assigned_driver_id = (select auth.uid()))
  with check (assigned_driver_id = (select auth.uid()));

drop policy if exists "load_stops_select_authenticated" on public.load_stops;
drop policy if exists "load_stops_select_own" on public.load_stops;
create policy "load_stops_select_own"
  on public.load_stops for select to authenticated
  using ((select public.owns_load(load_id)));

drop policy if exists "load_stops_write_driver_or_admin" on public.load_stops;
drop policy if exists "load_stops_write_own" on public.load_stops;
create policy "load_stops_write_own"
  on public.load_stops for all to authenticated
  using ((select public.owns_load(load_id)))
  with check ((select public.owns_load(load_id)));

drop policy if exists "load_trailer_history_select_authenticated" on public.load_trailer_history;
drop policy if exists "load_trailer_history_select_own" on public.load_trailer_history;
create policy "load_trailer_history_select_own"
  on public.load_trailer_history for select to authenticated
  using ((select public.owns_load(load_id)));
