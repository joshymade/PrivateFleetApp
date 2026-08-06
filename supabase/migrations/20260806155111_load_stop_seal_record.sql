-- Optional seal / sealed record per load stop.

alter table public.load_stops
  add column if not exists seal_record text;

comment on column public.load_stops.seal_record is
  'Optional seal / sealed record number for this stop. Null when not entered.';
