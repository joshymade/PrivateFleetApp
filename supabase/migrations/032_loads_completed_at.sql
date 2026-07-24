-- Stamp when a load was completed so pay_amount can lock after 20 days.

alter table public.loads
  add column if not exists completed_at timestamptz;

comment on column public.loads.completed_at is
  'When status became completed. Used to allow pay_amount edits for 20 days, then lock.';

-- Best-effort backfill for existing completed loads (updated_at ≈ last complete).
update public.loads
set completed_at = coalesce(completed_at, updated_at)
where status = 'completed'
  and completed_at is null;
