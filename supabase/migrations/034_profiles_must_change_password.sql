-- Force password change for admin-created accounts.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'When true, middleware gates the user to /account/change-password until cleared.';
