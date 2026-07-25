-- Daily earned pay for past work days with no loads logged.
-- Distinct from adp_entries (biweekly Average Daily Pay) and loads.pay_amount.

create table if not exists public.daily_pay_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  amount numeric(10, 2) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_pay_entries_amount_nonneg check (amount >= 0),
  constraint daily_pay_entries_note_len check (
    note is null or char_length(note) <= 500
  ),
  constraint daily_pay_entries_driver_date_uidx unique (driver_id, work_date)
);

create index if not exists daily_pay_entries_driver_date_idx
  on public.daily_pay_entries (driver_id, work_date desc);

comment on table public.daily_pay_entries is
  'Driver-entered earned pay for a past calendar day with no loads.';
comment on column public.daily_pay_entries.driver_id is
  'profiles.id (= auth.uid()), not company Driver ID text.';
comment on column public.daily_pay_entries.work_date is
  'Local calendar day (Postgres date); must be before today in app logic.';
comment on column public.daily_pay_entries.amount is
  'Dollar amount earned that day (flat; not load pay).';

alter table public.daily_pay_entries enable row level security;

drop policy if exists "daily_pay_entries_select_own" on public.daily_pay_entries;
create policy "daily_pay_entries_select_own"
  on public.daily_pay_entries for select to authenticated
  using (driver_id = (select auth.uid()));

drop policy if exists "daily_pay_entries_insert_own" on public.daily_pay_entries;
create policy "daily_pay_entries_insert_own"
  on public.daily_pay_entries for insert to authenticated
  with check (driver_id = (select auth.uid()));

drop policy if exists "daily_pay_entries_update_own" on public.daily_pay_entries;
create policy "daily_pay_entries_update_own"
  on public.daily_pay_entries for update to authenticated
  using (driver_id = (select auth.uid()))
  with check (driver_id = (select auth.uid()));

drop policy if exists "daily_pay_entries_delete_own" on public.daily_pay_entries;
create policy "daily_pay_entries_delete_own"
  on public.daily_pay_entries for delete to authenticated
  using (driver_id = (select auth.uid()));

grant select, insert, update, delete on public.daily_pay_entries to authenticated;
