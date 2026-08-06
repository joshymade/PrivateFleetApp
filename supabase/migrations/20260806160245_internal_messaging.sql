-- Internal admin↔ user messaging (no outbound email).
-- Extends contact_requests / contact_replies with admin-seeded threads + in-app notifies.

-- ---------------------------------------------------------------------------
-- contact_requests.source — who opened the thread
-- ---------------------------------------------------------------------------
alter table public.contact_requests
  add column if not exists source text not null default 'user';

alter table public.contact_requests
  drop constraint if exists contact_requests_source_check;

alter table public.contact_requests
  add constraint contact_requests_source_check
  check (source in ('user', 'admin'));

-- Admin-seeded threads may use an empty placeholder message (body lives in replies).
alter table public.contact_requests
  drop constraint if exists contact_requests_message_len;

alter table public.contact_requests
  add constraint contact_requests_message_len
  check (
    (
      source = 'user'
      and char_length(message) between 1 and 4000
    )
    or (
      source = 'admin'
      and char_length(message) <= 4000
    )
  );

comment on table public.contact_requests is
  'Internal contact threads between users and Admin (no email).';

comment on column public.contact_requests.source is
  'user = opened by the profile owner; admin = Admin seeded the thread to message first.';

-- Admin may seed a thread for any user (outbound messaging).
drop policy if exists contact_requests_insert_admin on public.contact_requests;
create policy contact_requests_insert_admin
  on public.contact_requests for insert to authenticated
  with check (
    (select public.is_admin())
    and source = 'admin'
  );

-- Users may only open threads as themselves (cannot spoof admin source).
drop policy if exists "contact_requests_insert_own" on public.contact_requests;
create policy "contact_requests_insert_own"
  on public.contact_requests for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and source = 'user'
  );

-- Ensure authenticated can use the tables via the Data API.
grant select, insert on public.contact_requests to authenticated;
grant select, insert, update on public.contact_replies to authenticated;

-- ---------------------------------------------------------------------------
-- Notification types for contact messaging
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
    'deletion_dismissed',
    'contact_message',
    'contact_reply'
  ));

-- ---------------------------------------------------------------------------
-- Notify all admins when a user opens / sends a contact request
-- ---------------------------------------------------------------------------
create or replace function public.notify_contact_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_preview text;
  v_admin record;
begin
  if new.source is distinct from 'user' then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.driver_id), ''), 'User')
    into v_name
  from public.profiles p
  where p.id = new.driver_id;

  v_preview := left(trim(new.message), 120);

  for v_admin in
    select id from public.profiles where role = 'admin' and disabled_at is null
  loop
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      actor_id
    ) values (
      v_admin.id,
      'contact_message',
      'New message from ' || v_name,
      nullif(v_preview, ''),
      new.driver_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists contact_request_notify on public.contact_requests;
create trigger contact_request_notify
  after insert on public.contact_requests
  for each row
  execute function public.notify_contact_message();

revoke execute on function public.notify_contact_message() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notify the user when Admin replies
-- ---------------------------------------------------------------------------
create or replace function public.notify_contact_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_preview text;
begin
  select cr.driver_id into v_user_id
  from public.contact_requests cr
  where cr.id = new.contact_request_id;

  if v_user_id is null then
    return new;
  end if;

  -- Do not notify the admin about their own reply if they somehow share the id.
  if v_user_id = new.admin_id then
    return new;
  end if;

  v_preview := left(trim(new.body), 120);

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    actor_id
  ) values (
    v_user_id,
    'contact_reply',
    'Reply from Admin',
    nullif(v_preview, ''),
    new.admin_id
  );

  return new;
end;
$$;

drop trigger if exists contact_reply_notify on public.contact_replies;
create trigger contact_reply_notify
  after insert on public.contact_replies
  for each row
  execute function public.notify_contact_reply();

revoke execute on function public.notify_contact_reply() from public, anon, authenticated;
