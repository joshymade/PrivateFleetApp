-- Stop type (Store / Vendor / DC) + optional per-stop pickup trailer.
-- When a stop trailer is set, app syncs loads.trailer_number (history via existing trigger).

alter table public.load_stops
  add column if not exists stop_type text;

update public.load_stops
set stop_type = 'store'
where stop_type is null;

alter table public.load_stops
  alter column stop_type set not null;

alter table public.load_stops
  drop constraint if exists load_stops_stop_type_check;

alter table public.load_stops
  add constraint load_stops_stop_type_check
  check (stop_type in ('store', 'vendor', 'dc'));

alter table public.load_stops
  add column if not exists trailer_number text;

comment on column public.load_stops.stop_type is
  'Stop category: store | vendor | dc (distribution center).';

comment on column public.load_stops.trailer_number is
  'Optional trailer picked up at this stop; app may sync to loads.trailer_number.';
