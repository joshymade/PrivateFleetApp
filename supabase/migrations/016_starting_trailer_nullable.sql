-- Starting trailer is no longer collected on the form; sequence uses stop pickups only.
-- Current trailer (loads.trailer_number) is derived from the last checked stop with a trailer.

alter table public.loads
  alter column starting_trailer_number drop not null;

comment on column public.loads.starting_trailer_number is
  'Optional legacy start trailer; Trailer(s) display prefers stop pickup trailers in delivery_order.';

comment on column public.loads.trailer_number is
  'Current/active trailer = last checked stop with a non-empty trailer_number; null when none or load completed.';
