-- Site-wide notice / alert bar (admin-scheduled by date range).

create table if not exists public.site_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_alerts_message_len check (char_length(message) between 1 and 140),
  constraint site_alerts_date_range check (ends_on >= starts_on)
);

comment on table public.site_alerts is
  'Admin-scheduled one-sentence notices shown in the app shell alert bar.';
comment on column public.site_alerts.message is
  'Single-sentence notice text (max 140 characters).';
comment on column public.site_alerts.starts_on is
  'First calendar day (inclusive) the alert may show.';
comment on column public.site_alerts.ends_on is
  'Last calendar day (inclusive) the alert may show.';
comment on column public.site_alerts.active is
  'When false, the alert is hidden even within its date range.';

create index if not exists site_alerts_active_dates_idx
  on public.site_alerts (active, starts_on, ends_on)
  where active = true;

alter table public.site_alerts enable row level security;

-- Authenticated users can read alerts (app shell filters to today + active).
drop policy if exists site_alerts_select_authenticated on public.site_alerts;
create policy site_alerts_select_authenticated
  on public.site_alerts for select
  to authenticated
  using (true);

drop policy if exists site_alerts_insert_admin on public.site_alerts;
create policy site_alerts_insert_admin
  on public.site_alerts for insert
  to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
  );

drop policy if exists site_alerts_update_admin on public.site_alerts;
create policy site_alerts_update_admin
  on public.site_alerts for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists site_alerts_delete_admin on public.site_alerts;
create policy site_alerts_delete_admin
  on public.site_alerts for delete
  to authenticated
  using ((select public.is_admin()));

grant select on public.site_alerts to authenticated;
grant insert, update, delete on public.site_alerts to authenticated;
grant select, insert, update, delete on public.site_alerts to service_role;
