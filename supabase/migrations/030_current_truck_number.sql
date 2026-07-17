-- Driver's persistent current truck (tractor) number + load snapshot at create time.
-- Drivers already update own profile rows via profiles_update_own.

alter table public.profiles
  add column if not exists current_truck_number text;

comment on column public.profiles.current_truck_number is
  'Driver''s current tractor/truck number; applied to new loads until changed.';

alter table public.loads
  add column if not exists truck_number text;

comment on column public.loads.truck_number is
  'Snapshot of the driver''s current truck number at load create time.';
