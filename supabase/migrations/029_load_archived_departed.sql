-- Load archive status, departed timestamps on stops, owner DELETE for archived loads.
-- Departed = load_stops.completed; departed time stored in arrived_at (existing column).

-- ---------------------------------------------------------------------------
-- loads.status: add archived
-- ---------------------------------------------------------------------------
alter table public.loads
  drop constraint if exists loads_status_check;

alter table public.loads
  add constraint loads_status_check
  check (status in ('active', 'pending', 'completed', 'cancelled', 'archived'));

alter table public.loads
  add column if not exists archived_at timestamptz;

comment on column public.loads.status is
  'active = current; pending = queued; completed = finished (counts in stats); archived = closed out (excluded from stats); cancelled = void.';

comment on column public.loads.archived_at is
  'When the load was archived (closed out without counting toward stats).';

-- ---------------------------------------------------------------------------
-- load_stops.arrived_at = departed timestamp (UX: Departed)
-- ---------------------------------------------------------------------------
comment on column public.load_stops.completed is
  'Driver marked this stop Departed. Once true, must not be unchecked. May promote stop.trailer_number to loads.trailer_number.';

comment on column public.load_stops.arrived_at is
  'When the stop was marked Departed (completed=true). Set once; never cleared.';

-- Backfill departed time for already-completed stops (best-effort).
update public.load_stops
set arrived_at = coalesce(arrived_at, created_at)
where completed = true
  and arrived_at is null;

-- ---------------------------------------------------------------------------
-- Owner DELETE on loads (hard delete after archive)
-- ---------------------------------------------------------------------------
drop policy if exists "loads_delete_own" on public.loads;
create policy "loads_delete_own"
  on public.loads for delete to authenticated
  using (assigned_driver_id = (select auth.uid()));
