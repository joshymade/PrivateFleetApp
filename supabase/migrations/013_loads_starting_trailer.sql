-- Persist the trailer the load began with. loads.trailer_number remains the
-- current/active trailer (last stop pickup or manual update) and must not be
-- treated as the journey start for Trailer(s) display.

alter table public.loads
  add column if not exists starting_trailer_number text;

-- Best-effort backfill: first stop pickup when present, else current trailer.
-- True start is unknown for older rows where the form value was overwritten.
update public.loads l
set starting_trailer_number = coalesce(
  (
    select s.trailer_number
    from public.load_stops s
    where s.load_id = l.id
      and s.trailer_number is not null
      and btrim(s.trailer_number) <> ''
    order by s.delivery_order asc
    limit 1
  ),
  l.trailer_number
)
where l.starting_trailer_number is null;

alter table public.loads
  alter column starting_trailer_number set not null;

comment on column public.loads.starting_trailer_number is
  'Trailer the load began with; Trailer(s) display starts here, then stop pickups.';

comment on column public.loads.trailer_number is
  'Current/active trailer (synced from last stop pickup when set).';
