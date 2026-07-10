-- Allow clearing the current/active trailer (e.g. Complete load).
-- starting_trailer_number stays NOT NULL for journey display.
-- History trigger skips null so load_trailer_history.trailer_number stays NOT NULL.

alter table public.loads
  alter column trailer_number drop not null;

comment on column public.loads.trailer_number is
  'Current/active trailer; null when cleared (e.g. load completed).';

create or replace function public.log_trailer_swap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.trailer_number is distinct from old.trailer_number
     and new.trailer_number is not null then
    insert into public.load_trailer_history (load_id, trailer_number, changed_by)
    values (new.id, new.trailer_number, (select auth.uid()));
  end if;
  return new;
end;
$$;
