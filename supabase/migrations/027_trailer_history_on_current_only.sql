-- Trailer history logs only when a trailer becomes current (loads.trailer_number
-- transitions to a new non-null value), not when a trailer is merely added/edited
-- on a stop. Consecutive duplicate history rows are skipped.
--
-- App syncs current trailer via sync_load_current_trailer():
--   record_history=true  → stop check/uncheck / promote (log transitions)
--   record_history=false → load form edits (update current, no history)

create or replace function public.log_trailer_swap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_trailer text;
  skip_history text;
begin
  skip_history := nullif(current_setting('app.skip_trailer_history', true), '');
  if skip_history = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.trailer_number is distinct from old.trailer_number
     and new.trailer_number is not null then
    select h.trailer_number
      into last_trailer
      from public.load_trailer_history h
     where h.load_id = new.id
     order by h.changed_at desc
     limit 1;

    -- No consecutive duplicate if the same trailer is already the latest history row.
    if last_trailer is not distinct from new.trailer_number then
      return new;
    end if;

    insert into public.load_trailer_history (load_id, trailer_number, changed_by)
    values (new.id, new.trailer_number, (select auth.uid()));
  end if;
  return new;
end;
$$;

comment on function public.log_trailer_swap() is
  'After loads.trailer_number changes to a new non-null value, append load_trailer_history unless skipped or consecutive duplicate.';

-- Recompute loads.trailer_number from last checked stop with a trailer.
-- When p_record_history is false (stop form edits), suppress history insert.
create or replace function public.sync_load_current_trailer(
  p_load_id uuid,
  p_record_history boolean default true
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trailer text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not ((select public.is_driver()) or (select public.is_admin())) then
    raise exception 'not allowed';
  end if;

  -- Current trailer = trailer on the last completed stop (by delivery_order)
  -- that has a non-empty trailer_number; null when none.
  select t.trailer_number
    into v_trailer
    from (
      select nullif(btrim(s.trailer_number), '') as trailer_number
        from public.load_stops s
       where s.load_id = p_load_id
         and s.completed = true
         and s.trailer_number is not null
         and btrim(s.trailer_number) <> ''
       order by s.delivery_order desc
       limit 1
    ) t;

  if not p_record_history then
    perform set_config('app.skip_trailer_history', 'on', true);
  end if;

  update public.loads
     set trailer_number = v_trailer
   where id = p_load_id;

  return v_trailer;
end;
$$;

comment on function public.sync_load_current_trailer(uuid, boolean) is
  'Set loads.trailer_number from last checked stop with trailer; optionally write load_trailer_history.';

revoke execute on function public.sync_load_current_trailer(uuid, boolean) from public;
revoke execute on function public.sync_load_current_trailer(uuid, boolean) from anon;
grant execute on function public.sync_load_current_trailer(uuid, boolean)
  to authenticated, service_role;
