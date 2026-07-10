-- Admin may delete any damage report. Child rows (photos, notices, comments,
-- safety_inbox_items, notifications) cascade via FK ON DELETE CASCADE.

drop policy if exists "damage_reports_delete_admin" on public.damage_reports;
create policy "damage_reports_delete_admin"
  on public.damage_reports for delete to authenticated
  using ((select public.is_admin()));
