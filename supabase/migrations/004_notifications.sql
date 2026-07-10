-- In-app Profile notifications (MVP - not push/OS).
-- Types: notice on your report, Feed reply on your report,
-- Safety inbox status change for sender, new referral for Safety/Admin,
-- load assignment for the assigned driver.
--
-- Apply after 001-003. Mirrored in 001_init.sql for greenfield.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
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

grant select, insert, update, delete on public.notifications
  to authenticated, service_role;
grant select on public.notifications to anon;

alter table public.notifications enable row level security;

-- Own rows only; inserts come from SECURITY DEFINER triggers (bypass RLS).
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

-- ---------------------------------------------------------------------------
-- Trigger helpers (SECURITY DEFINER - insert notifications for other users)
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

  -- Notify the driver who sent the referral when Safety updates status.
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
  -- Only notify when assignment changes on UPDATE (skip self-create noise).
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

-- Lock down DEFINER notify functions (same pattern as other DEFINER helpers).
revoke execute on function public.notify_report_noticed() from public, anon, authenticated;
revoke execute on function public.notify_report_comment() from public, anon, authenticated;
revoke execute on function public.notify_inbox_status() from public, anon, authenticated;
revoke execute on function public.notify_inbox_referral() from public, anon, authenticated;
revoke execute on function public.notify_load_assigned() from public, anon, authenticated;
