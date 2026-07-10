-- Profile work-out-of state (USPS 2-letter) + Home welcome preference.
-- Drivers already update own profile rows via profiles_update_own (role locked).

alter table public.profiles
  add column if not exists work_state text,
  add column if not exists show_work_state_on_home boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_work_state_usps;

alter table public.profiles
  add constraint profiles_work_state_usps check (
    work_state is null
    or work_state in (
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    )
  );

comment on column public.profiles.work_state is
  'USPS 2-letter code for the state the driver works out of; null if unset.';
comment on column public.profiles.show_work_state_on_home is
  'When true and work_state is set, Home welcome shows "out of {State}".';
