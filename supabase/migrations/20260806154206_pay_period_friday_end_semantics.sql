-- Clarify: next_pay_date is Friday period end; Thursday deposit is app-derived.
-- Correct legacy seeds that stored Thursday as period end (previous mistaken rule).

comment on column public.profiles.pay_period_start is
  'Seed start of the driver pay period (inclusive). With next_pay_date as Friday end, length = end - start + 1; later periods auto-advance by that length. Null until set.';

comment on column public.profiles.next_pay_date is
  'Seed end of the pay period (Friday). Later period ends = this date + n * period_length. Deposit/pay icon = Thursday of that end week (derived in app). Editable anytime with pay_period_start.';

-- Shift Thursday-ended seeds forward one day so end is Friday and length is preserved.
update public.profiles
set
  next_pay_date = next_pay_date + 1,
  pay_period_start = case
    when pay_period_start is not null then pay_period_start + 1
    else null
  end
where next_pay_date is not null
  and extract(dow from next_pay_date) = 4;
