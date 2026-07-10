-- Nested Feed replies: parent_id on damage_report_comments
-- Max nesting depth is enforced in the app (root + up to 2 nested levels).

alter table public.damage_report_comments
  add column if not exists parent_id uuid null
    references public.damage_report_comments (id) on delete cascade;

create index if not exists damage_report_comments_parent_idx
  on public.damage_report_comments (parent_id)
  where parent_id is not null;

comment on column public.damage_report_comments.parent_id is
  'Parent reply for nesting; null = top-level reply on the report.';

-- Insert: author is self; report exists; parent (if set) is on the same report.
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
    and (
      parent_id is null
      or exists (
        select 1
        from public.damage_report_comments parent
        where parent.id = parent_id
          and parent.damage_report_id = damage_report_id
      )
    )
  );
