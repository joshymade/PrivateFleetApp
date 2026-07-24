-- Anonymous system driver + original_reported_by + report deletion requests.
-- Drivers may anonymize (untag) their reports; only admin hard-deletes.

-- ---------------------------------------------------------------------------
-- profiles.is_system_anonymous
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_system_anonymous boolean not null default false;

comment on column public.profiles.is_system_anonymous is
  'True for the dedicated Anonymous Driver system profile used when a driver untags a report.';

create unique index if not exists profiles_one_system_anonymous_uidx
  on public.profiles (is_system_anonymous)
  where is_system_anonymous = true;

-- ---------------------------------------------------------------------------
-- System Anonymous Driver (auth.users + profiles)
-- Fixed UUID so app code can reference it stably.
-- ---------------------------------------------------------------------------
do $$
declare
  anon_id constant uuid := 'a0000000-0000-4000-8000-0000000000a1';
begin
  if not exists (select 1 from auth.users where id = anon_id) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      banned_until,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      anon_id,
      'authenticated',
      'authenticated',
      'anonymous-system@privatefleet.internal',
      crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(),
      'infinity',
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'is_system_anonymous', true
      ),
      jsonb_build_object(
        'full_name', 'Anonymous Driver',
        'driver_id', 'ANONYMOUS'
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  end if;

  -- handle_new_user creates the profile; ensure flags even if row already existed.
  insert into public.profiles (
    id,
    driver_id,
    email,
    full_name,
    role,
    is_system_anonymous,
    identity_changes_remaining,
    disabled_at
  ) values (
    anon_id,
    'ANONYMOUS',
    null,
    'Anonymous Driver',
    'driver',
    true,
    0,
    now()
  )
  on conflict (id) do update set
    driver_id = excluded.driver_id,
    full_name = excluded.full_name,
    email = null,
    role = 'driver',
    is_system_anonymous = true,
    identity_changes_remaining = 0,
    disabled_at = coalesce(public.profiles.disabled_at, now());
end $$;

create or replace function public.anonymous_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where is_system_anonymous = true
  limit 1;
$$;

comment on function public.anonymous_profile_id() is
  'UUID of the system Anonymous Driver profile.';

revoke all on function public.anonymous_profile_id() from public, anon;
grant execute on function public.anonymous_profile_id()
  to authenticated, service_role;

-- Block edits / role changes on the system anonymous profile (except service_role).
create or replace function public.enforce_system_anonymous_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system_anonymous then
      raise exception 'Cannot delete the system Anonymous Driver profile';
    end if;
    return old;
  end if;

  if old.is_system_anonymous then
    if (select auth.uid()) is not null then
      raise exception 'Cannot modify the system Anonymous Driver profile';
    end if;
    -- Allow service_role / SQL (auth.uid() null) but keep the flag.
    new.is_system_anonymous := true;
    new.full_name := 'Anonymous Driver';
    new.driver_id := 'ANONYMOUS';
    new.role := 'driver';
  end if;

  if new.is_system_anonymous and not old.is_system_anonymous then
    if (select auth.uid()) is not null then
      raise exception 'Cannot mark a profile as system anonymous';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_system_anonymous on public.profiles;
create trigger profiles_enforce_system_anonymous
  before update or delete on public.profiles
  for each row
  execute function public.enforce_system_anonymous_profile();

-- ---------------------------------------------------------------------------
-- damage_reports.original_reported_by
-- ---------------------------------------------------------------------------
alter table public.damage_reports
  add column if not exists original_reported_by uuid
    references public.profiles (id) on delete set null;

comment on column public.damage_reports.original_reported_by is
  'Reporting driver at create time. Preserved after untag/anonymize for deletion-request auth.';

update public.damage_reports
set original_reported_by = reported_by
where original_reported_by is null;

create index if not exists damage_reports_original_reported_by_idx
  on public.damage_reports (original_reported_by);

create or replace function public.set_damage_report_original_reported_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.original_reported_by is null then
    new.original_reported_by := new.reported_by;
  end if;
  return new;
end;
$$;

drop trigger if exists damage_reports_set_original_reported_by
  on public.damage_reports;
create trigger damage_reports_set_original_reported_by
  before insert on public.damage_reports
  for each row
  execute function public.set_damage_report_original_reported_by();

-- Refresh Feed view with original_reported_by
drop view if exists public.damage_reports_with_notice_count;

create view public.damage_reports_with_notice_count
with (security_invoker = true)
as
select
  dr.id,
  dr.asset_type,
  dr.asset_number,
  dr.driver_id,
  dr.reported_by,
  dr.original_reported_by,
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

grant select on public.damage_reports_with_notice_count
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Anonymize RPCs (no general UPDATE policy on damage_reports)
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_own_damage_reports()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  anon_id uuid;
  n integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.profiles
    where id = uid and is_system_anonymous
  ) then
    raise exception 'System user cannot anonymize reports';
  end if;

  anon_id := public.anonymous_profile_id();
  if anon_id is null then
    raise exception 'Anonymous Driver profile is not configured';
  end if;

  update public.damage_reports
  set
    reported_by = anon_id,
    driver_id = null,
    original_reported_by = coalesce(original_reported_by, uid)
  where reported_by = uid
    and reported_by is distinct from anon_id;

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.anonymize_own_damage_reports() is
  'Reassigns all of the caller''s damage reports to Anonymous Driver; preserves original_reported_by.';

revoke all on function public.anonymize_own_damage_reports() from public, anon;
grant execute on function public.anonymize_own_damage_reports()
  to authenticated, service_role;

create or replace function public.untag_damage_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  anon_id uuid;
  row_reported_by uuid;
  row_original uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  anon_id := public.anonymous_profile_id();
  if anon_id is null then
    raise exception 'Anonymous Driver profile is not configured';
  end if;

  select reported_by, coalesce(original_reported_by, reported_by)
    into row_reported_by, row_original
  from public.damage_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found';
  end if;

  if row_original is distinct from uid then
    raise exception 'Only the original reporting driver can untag this report';
  end if;

  if row_reported_by = anon_id then
    return; -- already untagged
  end if;

  if row_reported_by is distinct from uid then
    raise exception 'Only the current tagged reporter can untag this report';
  end if;

  update public.damage_reports
  set
    reported_by = anon_id,
    driver_id = null,
    original_reported_by = coalesce(original_reported_by, uid)
  where id = p_report_id;
end;
$$;

comment on function public.untag_damage_report(uuid) is
  'Reassigns one damage report to Anonymous Driver when called by the original reporter.';

revoke all on function public.untag_damage_report(uuid) from public, anon;
grant execute on function public.untag_damage_report(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Notification types for deletion requests
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'report_noticed',
    'report_comment',
    'inbox_status',
    'inbox_referral',
    'load_assigned',
    'deletion_request',
    'deletion_approved',
    'deletion_dismissed'
  ));

-- ---------------------------------------------------------------------------
-- report_deletion_requests
-- ---------------------------------------------------------------------------
create table if not exists public.report_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid not null
    references public.damage_reports (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'dismissed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_deletion_requests_message_len
    check (message is null or char_length(message) between 1 and 2000)
);

create unique index if not exists report_deletion_requests_one_pending_uidx
  on public.report_deletion_requests (damage_report_id)
  where status = 'pending';

create index if not exists report_deletion_requests_status_idx
  on public.report_deletion_requests (status, created_at desc);

create index if not exists report_deletion_requests_requested_by_idx
  on public.report_deletion_requests (requested_by, created_at desc);

comment on table public.report_deletion_requests is
  'Driver requests for admin to hard-delete an already-untagged damage report.';

alter table public.report_deletion_requests enable row level security;

drop policy if exists report_deletion_requests_select_own_or_admin
  on public.report_deletion_requests;
create policy report_deletion_requests_select_own_or_admin
  on public.report_deletion_requests for select to authenticated
  using (
    requested_by = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists report_deletion_requests_insert_requester
  on public.report_deletion_requests;
create policy report_deletion_requests_insert_requester
  on public.report_deletion_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.damage_reports dr
      where dr.id = damage_report_id
        and dr.original_reported_by = (select auth.uid())
        and dr.reported_by = public.anonymous_profile_id()
    )
  );

drop policy if exists report_deletion_requests_update_admin
  on public.report_deletion_requests;
create policy report_deletion_requests_update_admin
  on public.report_deletion_requests for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update on public.report_deletion_requests
  to authenticated;
grant select, insert, update, delete on public.report_deletion_requests
  to service_role;

-- Notify admins on new deletion request
create or replace function public.notify_deletion_request()
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
    select id from public.profiles
    where role = 'admin'
      and coalesce(is_system_anonymous, false) = false
  loop
    if recipient = new.requested_by then
      continue;
    end if;

    insert into public.notifications (
      user_id, type, title, body,
      damage_report_id, actor_id
    ) values (
      recipient,
      'deletion_request',
      'Report deletion requested',
      initcap(coalesce(asset_label, 'asset'))
        || ' '
        || coalesce(asset_num, '')
        || case
          when nullif(btrim(coalesce(new.message, '')), '') is not null
            then ': ' || left(btrim(new.message), 120)
          else ''
        end,
      new.damage_report_id,
      new.requested_by
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists report_deletion_request_notify
  on public.report_deletion_requests;
create trigger report_deletion_request_notify
  after insert on public.report_deletion_requests
  for each row
  execute function public.notify_deletion_request();

-- Notify requester when admin reviews
create or replace function public.notify_deletion_request_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_label text;
  asset_num text;
  notif_type text;
  notif_title text;
  notif_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status not in ('approved', 'dismissed') then
    return new;
  end if;

  select asset_type::text, asset_number
    into asset_label, asset_num
  from public.damage_reports
  where id = new.damage_report_id;

  if new.status = 'approved' then
    notif_type := 'deletion_approved';
    notif_title := 'Deletion request approved';
    notif_body := 'Admin deleted '
      || initcap(coalesce(asset_label, 'asset'))
      || ' '
      || coalesce(asset_num, '')
      || '.';
  else
    notif_type := 'deletion_dismissed';
    notif_title := 'Deletion request dismissed';
    notif_body := 'Admin kept '
      || initcap(coalesce(asset_label, 'asset'))
      || ' '
      || coalesce(asset_num, '')
      || ' on the Feed.';
  end if;

  insert into public.notifications (
    user_id, type, title, body,
    damage_report_id, actor_id
  ) values (
    new.requested_by,
    notif_type,
    notif_title,
    notif_body,
    case when new.status = 'dismissed' then new.damage_report_id else null end,
    new.reviewed_by
  );

  return new;
end;
$$;

drop trigger if exists report_deletion_request_reviewed_notify
  on public.report_deletion_requests;
create trigger report_deletion_request_reviewed_notify
  after update of status on public.report_deletion_requests
  for each row
  execute function public.notify_deletion_request_reviewed();
