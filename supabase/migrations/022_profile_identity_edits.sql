-- Driver identity edit budget (name + work_state) + admin contact email for requests.
-- First-time profile completion does NOT consume a change; only post-complete edits do.

alter table public.profiles
  add column if not exists identity_changes_remaining integer not null default 1,
  add column if not exists admin_contact_email text;

alter table public.profiles
  drop constraint if exists profiles_identity_changes_remaining_nonneg;

alter table public.profiles
  add constraint profiles_identity_changes_remaining_nonneg
  check (identity_changes_remaining >= 0);

alter table public.profiles
  drop constraint if exists profiles_admin_contact_email_format;

alter table public.profiles
  add constraint profiles_admin_contact_email_format
  check (
    admin_contact_email is null
    or admin_contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

comment on column public.profiles.identity_changes_remaining is
  'Driver free edits to full_name/work_state after profile is complete. Default 1; decremented on each post-setup identity change. Setup completion does not decrement.';

comment on column public.profiles.admin_contact_email is
  'Inbox address for driver Contact Admin requests. Editable on admin profiles only.';

-- Enforce edit budget + protect columns from client tampering.
create or replace function public.enforce_profile_identity_edits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  identity_changed boolean;
  was_complete boolean;
begin
  identity_changed :=
    new.full_name is distinct from old.full_name
    or new.work_state is distinct from old.work_state;

  was_complete :=
    old.work_state is not null
    and nullif(btrim(coalesce(old.full_name, '')), '') is not null;

  -- Only admin-role rows may set admin_contact_email.
  if new.admin_contact_email is distinct from old.admin_contact_email then
    if old.role <> 'admin' then
      raise exception 'Only admin profiles can set admin_contact_email';
    end if;
  end if;

  -- Clients must not increase the remaining budget (admins may via Table Editor / admin policy).
  if new.identity_changes_remaining > old.identity_changes_remaining then
    if not public.is_admin() then
      raise exception 'Cannot increase identity_changes_remaining';
    end if;
  end if;

  if identity_changed and old.role = 'driver' then
    if was_complete then
      if old.identity_changes_remaining <= 0 then
        raise exception 'No identity changes remaining. Contact admin.';
      end if;
      -- Single source of truth: always decrement exactly once per identity change.
      new.identity_changes_remaining := old.identity_changes_remaining - 1;
    else
      -- First-time setup (incomplete → still incomplete or complete): do not consume.
      new.identity_changes_remaining := old.identity_changes_remaining;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_identity_edits on public.profiles;
create trigger profiles_enforce_identity_edits
  before update on public.profiles
  for each row
  execute function public.enforce_profile_identity_edits();
