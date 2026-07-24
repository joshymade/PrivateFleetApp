-- Admin users: disable flag, contact reply inbox, admin load visibility for aggregates.
-- Destructive account/load/report ops use the service-role client in server actions.

-- ---------------------------------------------------------------------------
-- profiles.disabled_at — lock out without deleting
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists disabled_at timestamptz;

comment on column public.profiles.disabled_at is
  'When set, the account is disabled and must not access the app. Cleared to re-enable.';

create index if not exists profiles_disabled_at_idx
  on public.profiles (disabled_at)
  where disabled_at is not null;

-- ---------------------------------------------------------------------------
-- contact_replies — admin responses to contact_requests (driver inbox)
-- ---------------------------------------------------------------------------
create table if not exists public.contact_replies (
  id uuid primary key default gen_random_uuid(),
  contact_request_id uuid not null
    references public.contact_requests (id) on delete cascade,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint contact_replies_body_len check (char_length(body) between 1 and 4000)
);

create index if not exists contact_replies_request_id_idx
  on public.contact_replies (contact_request_id, created_at desc);

create index if not exists contact_replies_admin_id_idx
  on public.contact_replies (admin_id, created_at desc);

comment on table public.contact_replies is
  'Admin replies to driver contact_requests. Drivers see these on Contact Inbox.';

alter table public.contact_replies enable row level security;

drop policy if exists contact_replies_select_own_or_admin on public.contact_replies;
create policy contact_replies_select_own_or_admin
  on public.contact_replies for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.contact_requests cr
      where cr.id = contact_request_id
        and cr.driver_id = (select auth.uid())
    )
  );

drop policy if exists contact_replies_insert_admin on public.contact_replies;
create policy contact_replies_insert_admin
  on public.contact_replies for insert to authenticated
  with check (
    (select public.is_admin())
    and admin_id = (select auth.uid())
  );

drop policy if exists contact_replies_update_read_own on public.contact_replies;
create policy contact_replies_update_read_own
  on public.contact_replies for update to authenticated
  using (
    exists (
      select 1
      from public.contact_requests cr
      where cr.id = contact_request_id
        and cr.driver_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.contact_requests cr
      where cr.id = contact_request_id
        and cr.driver_id = (select auth.uid())
    )
  );

grant select, insert, update on public.contact_replies to authenticated;

-- ---------------------------------------------------------------------------
-- Loads: admin may SELECT all rows (aggregates / oversight). Mutations for
-- other users' loads still go through the service-role client.
-- ---------------------------------------------------------------------------
drop policy if exists loads_select_admin on public.loads;
create policy loads_select_admin
  on public.loads for select to authenticated
  using ((select public.is_admin()));

drop policy if exists load_stops_select_admin on public.load_stops;
create policy load_stops_select_admin
  on public.load_stops for select to authenticated
  using ((select public.is_admin()));

drop policy if exists load_trailer_history_select_admin on public.load_trailer_history;
create policy load_trailer_history_select_admin
  on public.load_trailer_history for select to authenticated
  using ((select public.is_admin()));
