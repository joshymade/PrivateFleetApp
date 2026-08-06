-- Optional pallet + position counts for store stops only (app clears on non-store).

alter table public.load_stops
  add column if not exists pallet_count integer,
  add column if not exists position_count integer;

alter table public.load_stops
  drop constraint if exists load_stops_pallet_count_check;
alter table public.load_stops
  add constraint load_stops_pallet_count_check
  check (pallet_count is null or pallet_count >= 0);

alter table public.load_stops
  drop constraint if exists load_stops_position_count_check;
alter table public.load_stops
  add constraint load_stops_position_count_check
  check (position_count is null or position_count >= 0);

comment on column public.load_stops.pallet_count is
  'Optional pallet count for store stops. Null when unset or stop is not a store.';

comment on column public.load_stops.position_count is
  'Optional position/movement count for store stops. Null when unset or stop is not a store.';
