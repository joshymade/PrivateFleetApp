-- Allow queued loads that wait until the driver's active load is completed.
-- Keeps loads_one_active_per_driver_uidx (partial unique on status = 'active').

alter table public.loads
  drop constraint if exists loads_status_check;

alter table public.loads
  add constraint loads_status_check
  check (status in ('active', 'pending', 'completed', 'cancelled'));

comment on column public.loads.status is
  'active = current; pending = queued until active is completed; completed/cancelled = terminal.';
