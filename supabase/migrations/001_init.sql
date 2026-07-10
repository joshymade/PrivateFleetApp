-- PrivateFleet initial schema
-- Roles: driver | safety | admin
-- Damage: trailer + tractor via asset_type / asset_number (R2 keys in DB)
-- Viewed tags: damage_notices (product language = "viewed")
-- Safety inbox: safety_inbox_items (driver referrals ≠|= "viewed")
--
-- Requires: Supabase Postgres 15+ (security_invoker views), auth.users, roles
--           anon / authenticated / service_role (Supabase Cloud or compatible).
--
-- Apply (preferred): Supabase MCP apply_migration, or Dashboard → SQL Editor.
-- Optional CLI: psql with a Cloud connection string from Project Settings → Database.
--
-- Prefer an empty public schema for first apply. If a partial run left objects,
-- drop conflicting app tables/views/functions then re-run the full file, e.g.:
--   drop view if exists public.damage_reports_with_notice_count;
--   drop table if exists public.notifications, public.damage_report_comments,
--     public.safety_inbox_items, public.damage_notices, public.damage_reports,
--     public.load_stops, public.load_trailer_history, public.loads, public.profiles cascade;
--   drop function if exists public.handle_new_user() cascade;
--   drop function if exists public.enforce_profile_role_change() cascade;
--   drop function if exists public.log_trailer_swap() cascade;
--   drop function if exists public.set_updated_at() cascade;
--   drop function if exists public.current_profile_role() cascade;
--   drop function if exists public.is_driver() cascade;
--   drop function if exists public.is_safety() cascade;
--   drop function if exists public.is_admin() cascade;
--   drop function if exists public.is_safety_or_admin() cascade;
--
-- Bootstrap first Admin: prefer app /signup with a Driver ID, then promote, e.g.
--   update public.profiles set role = 'admin' where driver_id = '<your-id>';
-- Auth Dashboard "Add user" also works (gets provisional tmp-<uuid> driver_id);
-- set a real driver_id / role afterward. service_role / SQL editor bypasses
-- the non-admin role-change trigger.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (auth.users ↔ company Driver ID + role)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Unique company Driver ID for drivers; null for safety/admin accounts.
  driver_id text,
  email text,
  full_name text,
  -- USPS 2-letter code; null if unset. See 009_profile_work_state.sql.
  work_state text,
  show_work_state_on_home boolean not null default true,
  -- Free post-setup edits to full_name/work_state (drivers). See 022.
  identity_changes_remaining integer not null default 1
    check (identity_changes_remaining >= 0),
  -- Admin inbox for driver Contact Admin requests. See 022.
  admin_contact_email text,
  role text not null default 'driver'
    check (role in ('driver', 'safety', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_id_format check (
    driver_id is null or char_length(trim(driver_id)) >= 1
  ),
  constraint driver_id_required_for_drivers check (
    role <> 'driver' or driver_id is not null
  ),
  constraint profiles_work_state_usps check (
    work_state is null
    or work_state in (
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    )
  ),
  constraint profiles_admin_contact_email_format check (
    admin_contact_email is null
    or admin_contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

-- Partial unique: multiple null driver_id rows OK for safety/admin.
create unique index if not exists profiles_driver_id_uidx
  on public.profiles (driver_id)
  where driver_id is not null;

create index if not exists profiles_role_idx on public.profiles (role);

-- Role helpers for RLS (after profiles exists). Never authorize from
-- raw_user_meta_data / JWT user_metadata — role lives in public.profiles.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())) = 'driver',
    false
  );
$$;

create or replace function public.is_safety()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())) = 'safety',
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())) = 'admin',
    false
  );
$$;

create or replace function public.is_safety_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid()))
      in ('safety', 'admin'),
    false
  );
$$;

-- Auto-create profile on signup.
-- Always role = driver (never trust user_metadata for elevation).
-- App signup passes driver_id (+ optional full_name) in raw_user_meta_data.
-- Auth Dashboard / admin API often omit metadata; use a unique provisional
-- driver_id so constraints still hold (Admin can edit / promote later).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_driver_id text;
  meta_full_name text;
begin
  meta_driver_id := nullif(trim(coalesce(new.raw_user_meta_data->>'driver_id', '')), '');
  meta_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  -- Never trust raw_user_meta_data->>'role' — always insert driver.
  if meta_driver_id is null then
    meta_driver_id := 'tmp-' || replace(new.id::text, '-', '');
  end if;

  begin
    insert into public.profiles (id, driver_id, email, full_name, role)
    values (
      new.id,
      meta_driver_id,
      new.email,
      meta_full_name,
      'driver'
    );
  exception
    when unique_violation then
      raise exception 'driver_id already in use'
        using errcode = '23505';
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block non-admins from changing roles (even if a loose UPDATE policy exists).
-- auth.uid() is null for Dashboard SQL / service_role bootstrap promotions.
create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if (select auth.uid()) is not null and not (select public.is_admin()) then
      raise exception 'Only admins can change roles'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_change on public.profiles;
create trigger profiles_enforce_role_change
  before update of role on public.profiles
  for each row execute function public.enforce_profile_role_change();

-- Driver identity edit budget (name/work_state). First-time setup does not consume.
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

  if new.admin_contact_email is distinct from old.admin_contact_email then
    if old.role <> 'admin' then
      raise exception 'Only admin profiles can set admin_contact_email';
    end if;
  end if;

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
      new.identity_changes_remaining := old.identity_changes_remaining - 1;
    else
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

-- ---------------------------------------------------------------------------
-- Loads
-- ---------------------------------------------------------------------------
create table public.loads (
  id uuid primary key default gen_random_uuid(),
  load_number text not null,
  -- Optional legacy start trailer; Trailer(s) display prefers stop pickups.
  starting_trailer_number text,
  -- Current/active trailer = last checked stop with trailer; null when none/completed.
  trailer_number text,
  route_number text,
  load_date date not null default current_date,
  assigned_miles numeric(10, 2),
  assigned_driver_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'pending', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (load_number, load_date)
);

create index if not exists loads_trailer_number_idx on public.loads (trailer_number);
create index if not exists loads_assigned_driver_idx on public.loads (assigned_driver_id);
create index if not exists loads_load_date_idx on public.loads (load_date desc);
-- At most one active load per assigned driver (null assignee excluded).
create unique index if not exists loads_one_active_per_driver_uidx
  on public.loads (assigned_driver_id)
  where status = 'active'
    and assigned_driver_id is not null;

create table public.load_trailer_history (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  trailer_number text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index if not exists load_trailer_history_load_id_idx
  on public.load_trailer_history (load_id, changed_at desc);

create table public.load_stops (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  stop_type text not null
    check (stop_type in ('store', 'vendor', 'dc')),
  stop_name text not null,
  pickup_number text,
  trailer_number text,
  delivery_order integer not null,
  -- Driver marked stop done; check may promote trailer_number to loads.trailer_number
  completed boolean not null default false,
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (load_id, delivery_order)
);

create index if not exists load_stops_load_id_idx on public.load_stops (load_id, delivery_order);

-- ---------------------------------------------------------------------------
-- Damage reports (photo in R2; metadata here)
-- asset_type: trailer | tractor — one table for both capture flows
-- ---------------------------------------------------------------------------
create table public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null default 'trailer'
    check (asset_type in ('trailer', 'tractor')),
  asset_number text not null,
  driver_id text,                          -- snapshot of company Driver ID at capture
  reported_by uuid not null references public.profiles (id) on delete restrict,
  load_id uuid references public.loads (id) on delete set null,
  route_number text,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz not null default now(),
  r2_key text not null unique,
  r2_url text,
  -- Driver description of damage at upload (not a Feed reply).
  report_comment text,
  -- Detail page opens (/feed/[id]); distinct from damage_notices ("Notice").
  view_count integer not null default 0
    constraint damage_reports_view_count_nonnegative check (view_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists damage_reports_asset_idx
  on public.damage_reports (asset_type, asset_number, captured_at desc);
create index if not exists damage_reports_captured_at_idx
  on public.damage_reports (captured_at desc);
create index if not exists damage_reports_reported_by_idx
  on public.damage_reports (reported_by);

-- "Viewed" tags (legacy table name damage_notices; no duplicate photos)
create table public.damage_notices (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  noticed_by uuid not null references public.profiles (id) on delete cascade,
  noticed_at timestamptz not null default now(),
  unique (damage_report_id, noticed_by)
);

create index if not exists damage_notices_report_idx
  on public.damage_notices (damage_report_id, noticed_at desc);
create index if not exists damage_notices_noticed_by_idx
  on public.damage_notices (noticed_by);

-- Safety inbox: driver referrals (distinct from viewed / notices)
create table public.safety_inbox_items (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  sent_by uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'dismissed')),
  note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null
);

-- At most one open (pending) referral per damage report.
create unique index if not exists safety_inbox_one_pending_per_report
  on public.safety_inbox_items (damage_report_id)
  where status = 'pending';

create index if not exists safety_inbox_status_sent_at_idx
  on public.safety_inbox_items (status, sent_at desc);
create index if not exists safety_inbox_sent_by_idx
  on public.safety_inbox_items (sent_by);

-- Feed reply comments (distinct from damage_reports.report_comment)
create table public.damage_report_comments (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint damage_report_comments_body_nonempty check (
    char_length(trim(body)) >= 1
  )
);

create index if not exists damage_report_comments_report_idx
  on public.damage_report_comments (damage_report_id, created_at asc);
create index if not exists damage_report_comments_author_idx
  on public.damage_report_comments (author_id);

-- In-app Profile notifications (MVP; push/OS later). Live Cloud also has 004_notifications.sql.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    check (type in (
      'report_noticed',
      'report_comment',
      'inbox_status',
      'inbox_referral',
      'load_assigned'
    )),
  title text not null,
  body text,
  damage_report_id uuid references public.damage_reports (id) on delete cascade,
  safety_inbox_item_id uuid references public.safety_inbox_items (id) on delete cascade,
  load_id uuid references public.loads (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

comment on table public.notifications is
  'In-app Profile notifications; push/OS is out of MVP scope.';

-- Search / Feed helper — invoker so RLS on underlying tables still applies (PG15+).
-- Explicit columns (not dr.*) so renames on damage_reports do not leave stale aliases.
create or replace view public.damage_reports_with_notice_count
with (security_invoker = true)
as
select
  dr.id,
  dr.asset_type,
  dr.asset_number,
  dr.driver_id,
  dr.reported_by,
  dr.load_id,
  dr.route_number,
  dr.latitude,
  dr.longitude,
  dr.captured_at,
  dr.r2_key,
  dr.r2_url,
  dr.report_comment,
  dr.view_count,
  dr.created_at,
  coalesce(n.notice_count, 0)::int as notice_count
from public.damage_reports dr
left join (
  select damage_report_id, count(*)::int as notice_count
  from public.damage_notices
  group by damage_report_id
) n on n.damage_report_id = dr.id;

-- Page view counter for damage report detail (/feed/[reportId]).
-- SECURITY DEFINER — no general UPDATE policy on damage_reports; body checks auth.
create or replace function public.increment_damage_report_view(p_report_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  update public.damage_reports
  set view_count = view_count + 1
  where id = p_report_id
  returning view_count into new_count;

  if new_count is null then
    raise exception 'Report not found';
  end if;

  return new_count;
end;
$$;

comment on function public.increment_damage_report_view(uuid) is
  'Increments damage_reports.view_count by 1 for an authenticated viewer who can open the report detail page.';

-- ---------------------------------------------------------------------------
-- updated_at + trailer-swap audit
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists loads_set_updated_at on public.loads;
create trigger loads_set_updated_at
  before update on public.loads
  for each row execute function public.set_updated_at();

create or replace function public.log_trailer_swap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.trailer_number is distinct from old.trailer_number
     and new.trailer_number is not null then
    insert into public.load_trailer_history (load_id, trailer_number, changed_by)
    values (new.id, new.trailer_number, (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists loads_log_trailer_swap on public.loads;
create trigger loads_log_trailer_swap
  after update of trailer_number on public.loads
  for each row execute function public.log_trailer_swap();

-- ---------------------------------------------------------------------------
-- Notification triggers (SECURITY DEFINER — insert for other users)
-- Live Cloud also has 004_notifications.sql for DBs that applied 001 earlier.
-- ---------------------------------------------------------------------------
create or replace function public.notify_report_noticed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_owner uuid;
  asset_label text;
  asset_num text;
begin
  select reported_by, asset_type::text, asset_number
    into report_owner, asset_label, asset_num
  from public.damage_reports
  where id = new.damage_report_id;

  if report_owner is null or report_owner = new.noticed_by then
    return new;
  end if;

  insert into public.notifications (
    user_id, type, title, body, damage_report_id, actor_id
  ) values (
    report_owner,
    'report_noticed',
    'Your report was noticed',
    initcap(coalesce(asset_label, 'asset')) || ' ' || coalesce(asset_num, ''),
    new.damage_report_id,
    new.noticed_by
  );

  return new;
end;
$$;

drop trigger if exists damage_notices_notify on public.damage_notices;
create trigger damage_notices_notify
  after insert on public.damage_notices
  for each row execute function public.notify_report_noticed();

create or replace function public.notify_report_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_owner uuid;
  parent_author uuid;
  asset_label text;
  asset_num text;
  snippet text;
  asset_prefix text;
begin
  select reported_by, asset_type::text, asset_number
    into report_owner, asset_label, asset_num
  from public.damage_reports
  where id = new.damage_report_id;

  snippet := left(trim(new.body), 120);
  asset_prefix :=
    initcap(coalesce(asset_label, 'asset')) || ' ' || coalesce(asset_num, '');

  if new.parent_id is not null then
    select author_id into parent_author
    from public.damage_report_comments
    where id = new.parent_id;

    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications (
        user_id, type, title, body, damage_report_id, actor_id
      ) values (
        parent_author,
        'report_comment',
        'New reply to your comment',
        asset_prefix
          || case when snippet <> '' then ': ' || snippet else '' end,
        new.damage_report_id,
        new.author_id
      );
    end if;
  end if;

  if report_owner is not null
     and report_owner <> new.author_id
     and (parent_author is null or report_owner <> parent_author) then
    insert into public.notifications (
      user_id, type, title, body, damage_report_id, actor_id
    ) values (
      report_owner,
      'report_comment',
      'New reply on your report',
      asset_prefix
        || case when snippet <> '' then ': ' || snippet else '' end,
      new.damage_report_id,
      new.author_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists damage_report_comments_notify on public.damage_report_comments;
create trigger damage_report_comments_notify
  after insert on public.damage_report_comments
  for each row execute function public.notify_report_comment();

create or replace function public.notify_inbox_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.sent_by is not null
     and (new.reviewed_by is null or new.reviewed_by <> new.sent_by) then
    insert into public.notifications (
      user_id, type, title, body,
      damage_report_id, safety_inbox_item_id, actor_id
    ) values (
      new.sent_by,
      'inbox_status',
      'Safety inbox update',
      'Your referral is now ' || new.status,
      new.damage_report_id,
      new.id,
      new.reviewed_by
    );
  end if;

  return new;
end;
$$;

drop trigger if exists safety_inbox_status_notify on public.safety_inbox_items;
create trigger safety_inbox_status_notify
  after update of status on public.safety_inbox_items
  for each row execute function public.notify_inbox_status();

create or replace function public.notify_inbox_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  asset_label text;
  asset_num text;
begin
  select asset_type::text, asset_number
    into asset_label, asset_num
  from public.damage_reports
  where id = new.damage_report_id;

  for recipient in
    select id from public.profiles where role in ('safety', 'admin')
  loop
    if recipient = new.sent_by then
      continue;
    end if;

    insert into public.notifications (
      user_id, type, title, body,
      damage_report_id, safety_inbox_item_id, actor_id
    ) values (
      recipient,
      'inbox_referral',
      'New Safety referral',
      initcap(coalesce(asset_label, 'asset')) || ' ' || coalesce(asset_num, ''),
      new.damage_report_id,
      new.id,
      new.sent_by
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists safety_inbox_referral_notify on public.safety_inbox_items;
create trigger safety_inbox_referral_notify
  after insert on public.safety_inbox_items
  for each row execute function public.notify_inbox_referral();

create or replace function public.notify_load_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_driver_id is null then
    return new;
  end if;

  if old.assigned_driver_id is not distinct from new.assigned_driver_id then
    return new;
  end if;

  insert into public.notifications (
    user_id, type, title, body, load_id
  ) values (
    new.assigned_driver_id,
    'load_assigned',
    'Load assigned',
    'Load ' || coalesce(new.load_number, '') ||
      case
        when new.load_date is not null then ' - ' || new.load_date::text
        else ''
      end,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists loads_assigned_notify on public.loads;
create trigger loads_assigned_notify
  after update of assigned_driver_id on public.loads
  for each row execute function public.notify_load_assigned();

-- ---------------------------------------------------------------------------
-- Grants (PostgREST / Data API need these on public objects)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant select on all tables in schema public to anon;

grant select on public.damage_reports_with_notice_count
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to authenticated, service_role;

-- Drop default PUBLIC execute on SECURITY DEFINER helpers (Cloud Data API).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_profile_role_change() from public, anon, authenticated;
revoke execute on function public.log_trailer_swap() from public, anon, authenticated;
revoke execute on function public.notify_report_noticed() from public, anon, authenticated;
revoke execute on function public.notify_report_comment() from public, anon, authenticated;
revoke execute on function public.notify_inbox_status() from public, anon, authenticated;
revoke execute on function public.notify_inbox_referral() from public, anon, authenticated;
revoke execute on function public.notify_load_assigned() from public, anon, authenticated;
revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.is_driver() from public, anon;
revoke execute on function public.is_safety() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_safety_or_admin() from public, anon;
revoke execute on function public.increment_damage_report_view(uuid)
  from public, anon;

grant execute on function public.current_profile_role() to authenticated, service_role;
grant execute on function public.is_driver() to authenticated, service_role;
grant execute on function public.is_safety() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_safety_or_admin() to authenticated, service_role;
grant execute on function public.increment_damage_report_view(uuid)
  to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant select on tables to anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.loads enable row level security;
alter table public.load_trailer_history enable row level security;
alter table public.load_stops enable row level security;
alter table public.damage_reports enable row level security;
alter table public.damage_notices enable row level security;
alter table public.safety_inbox_items enable row level security;
alter table public.damage_report_comments enable row level security;
alter table public.notifications enable row level security;

-- Profiles: fleet can read; users update own (role immutable via WITH CHECK + trigger);
-- admins can update any profile (roles management).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (
      select p.role from public.profiles p where p.id = (select auth.uid())
    )
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Loads: authenticated fleet read; drivers + admins write.
drop policy if exists "loads_select_authenticated" on public.loads;
create policy "loads_select_authenticated"
  on public.loads for select to authenticated
  using (true);

drop policy if exists "loads_insert_driver_or_admin" on public.loads;
create policy "loads_insert_driver_or_admin"
  on public.loads for insert to authenticated
  with check ((select public.is_driver()) or (select public.is_admin()));

drop policy if exists "loads_update_driver_or_admin" on public.loads;
create policy "loads_update_driver_or_admin"
  on public.loads for update to authenticated
  using ((select public.is_driver()) or (select public.is_admin()))
  with check ((select public.is_driver()) or (select public.is_admin()));

drop policy if exists "load_stops_select_authenticated" on public.load_stops;
create policy "load_stops_select_authenticated"
  on public.load_stops for select to authenticated
  using (true);

drop policy if exists "load_stops_write_driver_or_admin" on public.load_stops;
create policy "load_stops_write_driver_or_admin"
  on public.load_stops for all to authenticated
  using ((select public.is_driver()) or (select public.is_admin()))
  with check ((select public.is_driver()) or (select public.is_admin()));

drop policy if exists "load_trailer_history_select_authenticated" on public.load_trailer_history;
create policy "load_trailer_history_select_authenticated"
  on public.load_trailer_history for select to authenticated
  using (true);

-- Damage: fleet read; only drivers upload own rows; Safety/Admin view-only writes.
drop policy if exists "damage_reports_select_authenticated" on public.damage_reports;
create policy "damage_reports_select_authenticated"
  on public.damage_reports for select to authenticated
  using (true);

drop policy if exists "damage_reports_insert_driver_own" on public.damage_reports;
create policy "damage_reports_insert_driver_own"
  on public.damage_reports for insert to authenticated
  with check (
    (select public.is_driver())
    and reported_by = (select auth.uid())
  );

-- Notice (legacy "viewed"): any authenticated fleet member can Notice as self.
-- Live Cloud also has 003_notice_rls_drivers.sql for DBs that applied older Safety-only policies.
drop policy if exists "damage_notices_select_authenticated" on public.damage_notices;
create policy "damage_notices_select_authenticated"
  on public.damage_notices for select to authenticated
  using (true);

drop policy if exists "damage_notices_insert_safety_or_admin" on public.damage_notices;
drop policy if exists "damage_notices_insert_own" on public.damage_notices;
create policy "damage_notices_insert_own"
  on public.damage_notices for insert to authenticated
  with check (noticed_by = (select auth.uid()));

drop policy if exists "damage_notices_delete_own_safety_or_admin" on public.damage_notices;
drop policy if exists "damage_notices_delete_own" on public.damage_notices;
create policy "damage_notices_delete_own"
  on public.damage_notices for delete to authenticated
  using (noticed_by = (select auth.uid()));

-- Inbox: drivers send own reports; Safety/Admin see all and update status.
drop policy if exists "safety_inbox_select" on public.safety_inbox_items;
create policy "safety_inbox_select"
  on public.safety_inbox_items for select to authenticated
  using (
    sent_by = (select auth.uid())
    or (select public.is_safety_or_admin())
  );

drop policy if exists "safety_inbox_insert_own_report" on public.safety_inbox_items;
create policy "safety_inbox_insert_own_report"
  on public.safety_inbox_items for insert to authenticated
  with check (
    sent_by = (select auth.uid())
    and exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
        and dr.reported_by = (select auth.uid())
    )
  );

drop policy if exists "safety_inbox_update_safety_or_admin" on public.safety_inbox_items;
create policy "safety_inbox_update_safety_or_admin"
  on public.safety_inbox_items for update to authenticated
  using ((select public.is_safety_or_admin()))
  with check ((select public.is_safety_or_admin()));

-- Feed replies: fleet read; insert/update as self; delete own or Admin.
drop policy if exists "damage_report_comments_select_authenticated"
  on public.damage_report_comments;
create policy "damage_report_comments_select_authenticated"
  on public.damage_report_comments for select to authenticated
  using (true);

drop policy if exists "damage_report_comments_insert_own"
  on public.damage_report_comments;
create policy "damage_report_comments_insert_own"
  on public.damage_report_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
    )
  );

drop policy if exists "damage_report_comments_update_own"
  on public.damage_report_comments;
create policy "damage_report_comments_update_own"
  on public.damage_report_comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "damage_report_comments_delete_own_or_admin"
  on public.damage_report_comments;
create policy "damage_report_comments_delete_own_or_admin"
  on public.damage_report_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Notifications: own rows only (inserts via DEFINER triggers).
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
