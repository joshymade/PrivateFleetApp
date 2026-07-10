-- Persist per-stop "done" checkbox on load detail / Home.
-- Checking a stop with trailer_number promotes loads.trailer_number (history via existing trigger).
-- Unchecking only clears completed; does not revert the load trailer.

alter table public.load_stops
  add column if not exists completed boolean not null default false;

comment on column public.load_stops.completed is
  'Driver marked this stop done (UI strikethrough). Check may promote stop.trailer_number to loads.trailer_number; uncheck does not revert trailer.';
