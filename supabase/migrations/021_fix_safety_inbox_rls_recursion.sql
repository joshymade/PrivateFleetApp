-- Break RLS policy dependency cycle between damage_reports and
-- safety_inbox_items (and photos). Postgres raises
-- "infinite recursion detected in policy for relation safety_inbox_items"
-- when policies on A EXISTS-check B and policies on B EXISTS-check A,
-- even when a given statement would not recurse at runtime.
--
-- Also fixes 019 unqualified column bugs that Postgres bound to the inner
-- alias (si.damage_report_id = si.id / si.damage_report_id = si.damage_report_id).

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (bypass RLS for membership checks only)
-- ---------------------------------------------------------------------------
create or replace function public.report_referred_to_safety(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.safety_inbox_items si
    where si.damage_report_id = p_report_id
  );
$$;

create or replace function public.user_owns_damage_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.damage_reports dr
    where dr.id = p_report_id
      and dr.reported_by = (select auth.uid())
  );
$$;

revoke execute on function public.report_referred_to_safety(uuid)
  from public, anon;
revoke execute on function public.user_owns_damage_report(uuid)
  from public, anon;

grant execute on function public.report_referred_to_safety(uuid)
  to authenticated, service_role;
grant execute on function public.user_owns_damage_report(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- damage_reports / photos: Safety sees referred rows via helper (no inbox RLS)
-- ---------------------------------------------------------------------------
drop policy if exists "damage_reports_select_authenticated" on public.damage_reports;
create policy "damage_reports_select_authenticated"
  on public.damage_reports for select to authenticated
  using (
    not (select public.is_safety())
    or (select public.report_referred_to_safety(id))
  );

drop policy if exists "damage_report_photos_select_authenticated"
  on public.damage_report_photos;
create policy "damage_report_photos_select_authenticated"
  on public.damage_report_photos for select to authenticated
  using (
    not (select public.is_safety())
    or (select public.report_referred_to_safety(damage_report_id))
  );

-- ---------------------------------------------------------------------------
-- safety_inbox insert: ownership check via helper (no damage_reports RLS)
-- ---------------------------------------------------------------------------
drop policy if exists "safety_inbox_insert_own_report" on public.safety_inbox_items;
create policy "safety_inbox_insert_own_report"
  on public.safety_inbox_items for insert to authenticated
  with check (
    sent_by = (select auth.uid())
    and (select public.user_owns_damage_report(damage_report_id))
  );
