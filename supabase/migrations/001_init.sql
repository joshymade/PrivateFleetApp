-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (Driver ID linked to auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  driver_id text not null unique,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_id_format check (char_length(trim(driver_id)) >= 1)
);

create index profiles_driver_id_idx on public.profiles (driver_id);

-- Auto-create profile on signup (expects driver_id in raw_user_meta_data)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, driver_id, email, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'driver_id', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Loads
-- ---------------------------------------------------------------------------
create table public.loads (
  id uuid primary key default gen_random_uuid(),
  load_number text not null,
  trailer_number text not null,          -- current trailer (swappable)
  route_number text,
  load_date date not null default current_date,
  assigned_miles numeric(10, 2),
  assigned_driver_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (load_number, load_date)
);

create index loads_trailer_number_idx on public.loads (trailer_number);
create index loads_assigned_driver_idx on public.loads (assigned_driver_id);
create index loads_load_date_idx on public.loads (load_date desc);

-- Optional audit of trailer swaps on a load
create table public.load_trailer_history (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  trailer_number text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index load_trailer_history_load_id_idx
  on public.load_trailer_history (load_id, changed_at desc);

-- Stops: names, pickup #s, delivery order
create table public.load_stops (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  stop_name text not null,
  pickup_number text,
  delivery_order integer not null,
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (load_id, delivery_order)
);

create index load_stops_load_id_idx on public.load_stops (load_id, delivery_order);

-- ---------------------------------------------------------------------------
-- Damage reports (photo in R2; metadata here)
-- ---------------------------------------------------------------------------
create table public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  trailer_number text not null,
  driver_id text not null,                 -- snapshot of company Driver ID
  reported_by uuid not null references public.profiles (id) on delete restrict,
  load_id uuid references public.loads (id) on delete set null,
  route_number text,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz not null default now(),
  r2_key text not null unique,             -- object key in Cloudflare R2
  r2_url text,                             -- optional public/CDN URL
  notes text,
  created_at timestamptz not null default now()
);

create index damage_reports_trailer_idx
  on public.damage_reports (trailer_number, captured_at desc);
create index damage_reports_captured_at_idx
  on public.damage_reports (captured_at desc);
create index damage_reports_reported_by_idx
  on public.damage_reports (reported_by);

-- "Noticed" validations (no duplicate photos)
create table public.damage_notices (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  noticed_by uuid not null references public.profiles (id) on delete cascade,
  noticed_at timestamptz not null default now(),
  unique (damage_report_id, noticed_by)
);

create index damage_notices_report_idx
  on public.damage_notices (damage_report_id, noticed_at desc);

-- Convenience view for search UI
create or replace view public.damage_reports_with_notice_count as
select
  dr.*,
  coalesce(n.notice_count, 0)::int as notice_count
from public.damage_reports dr
left join (
  select damage_report_id, count(*)::int as notice_count
  from public.damage_notices
  group by damage_report_id
) n on n.damage_report_id = dr.id;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger loads_set_updated_at
  before update on public.loads
  for each row execute function public.set_updated_at();

-- When trailer_number changes on a load, append history
create or replace function public.log_trailer_swap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.trailer_number is distinct from old.trailer_number then
    insert into public.load_trailer_history (load_id, trailer_number, changed_by)
    values (new.id, new.trailer_number, auth.uid());
  end if;
  return new;
end;
$$;

create trigger loads_log_trailer_swap
  after update of trailer_number on public.loads
  for each row execute function public.log_trailer_swap();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.loads enable row level security;
alter table public.load_trailer_history enable row level security;
alter table public.load_stops enable row level security;
alter table public.damage_reports enable row level security;
alter table public.damage_notices enable row level security;

-- Profiles: read all (fleet peers), update own
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Loads: authenticated fleet can read/update (tighten later per company)
create policy "loads_select_authenticated"
  on public.loads for select to authenticated using (true);
create policy "loads_insert_authenticated"
  on public.loads for insert to authenticated with check (true);
create policy "loads_update_authenticated"
  on public.loads for update to authenticated using (true) with check (true);

create policy "load_stops_all_authenticated"
  on public.load_stops for all to authenticated
  using (true) with check (true);

create policy "load_trailer_history_select_authenticated"
  on public.load_trailer_history for select to authenticated using (true);

-- Damage: any authenticated driver can read fleet damage; insert own; notice once
create policy "damage_reports_select_authenticated"
  on public.damage_reports for select to authenticated using (true);
create policy "damage_reports_insert_own"
  on public.damage_reports for insert to authenticated
  with check (reported_by = auth.uid());

create policy "damage_notices_select_authenticated"
  on public.damage_notices for select to authenticated using (true);
create policy "damage_notices_insert_own"
  on public.damage_notices for insert to authenticated
  with check (noticed_by = auth.uid());
create policy "damage_notices_delete_own"
  on public.damage_notices for delete to authenticated
  using (noticed_by = auth.uid());
