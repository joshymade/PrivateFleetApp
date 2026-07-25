-- Anchor payday for biweekly pay-period Home view.
-- Drivers enter any known payday; app steps ±14 days from that date.

alter table public.profiles
  add column if not exists next_pay_date date;

comment on column public.profiles.next_pay_date is
  'Known payday (date). Future paydays = this date ± 14 days (same weekday). Editable anytime.';
