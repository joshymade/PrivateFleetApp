-- Extend damage_notices RLS so Drivers (and all authenticated fleet members)
-- can Notice / un-Notice on Feed — not Safety/Admin only.
-- Product: Notice maps to damage_notices; unique (damage_report_id, noticed_by).

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
