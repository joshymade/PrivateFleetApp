-- Seed start of a driver's pay period range.
-- With next_pay_date (period end / Thursday payday), the app infers length and
-- auto-advances subsequent contiguous periods from this seed.

alter table public.profiles
  add column if not exists pay_period_start date;

comment on column public.profiles.pay_period_start is
  'Seed start of the driver pay period (inclusive). With next_pay_date as end/payday, length = end - start + 1; later periods auto-advance by that length. Null until set.';

comment on column public.profiles.next_pay_date is
  'Seed end of the pay period / payday (Thursday). Later paydays = this date + n * period_length. Editable anytime with pay_period_start.';

-- Backfill: existing payday-only rows assumed the prior 14-day window ending on payday.
update public.profiles
set pay_period_start = next_pay_date - 13
where next_pay_date is not null
  and pay_period_start is null;
