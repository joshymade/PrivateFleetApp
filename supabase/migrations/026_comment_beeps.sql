-- One-way "beep" on Feed reply comments (like Notice — no undo).
-- Join table so counts are accurate; UNIQUE(comment_id, user_id) prevents duplicates.
-- No DELETE policy for authenticated users — beeps are permanent.

create table public.damage_report_comment_beeps (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null
    references public.damage_report_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint damage_report_comment_beeps_unique unique (comment_id, user_id)
);

create index if not exists damage_report_comment_beeps_comment_idx
  on public.damage_report_comment_beeps (comment_id, created_at desc);

create index if not exists damage_report_comment_beeps_user_idx
  on public.damage_report_comment_beeps (user_id);

comment on table public.damage_report_comment_beeps is
  'One-way beeps on Feed reply comments; unique per (comment, user); no user undo.';

-- Grants (Data API): select + insert only — no delete for authenticated.
grant select, insert on public.damage_report_comment_beeps
  to authenticated, service_role;
grant select on public.damage_report_comment_beeps to anon;

alter table public.damage_report_comment_beeps enable row level security;

drop policy if exists "damage_report_comment_beeps_select_authenticated"
  on public.damage_report_comment_beeps;
create policy "damage_report_comment_beeps_select_authenticated"
  on public.damage_report_comment_beeps for select to authenticated
  using (true);

drop policy if exists "damage_report_comment_beeps_insert_own"
  on public.damage_report_comment_beeps;
create policy "damage_report_comment_beeps_insert_own"
  on public.damage_report_comment_beeps for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.damage_report_comments c
      where c.id = comment_id
    )
  );

-- Intentionally no DELETE policy for authenticated — beeps cannot be undone.
