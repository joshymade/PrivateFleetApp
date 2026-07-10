-- Fleet-wide damage report aggregates for Safety/Admin Home.
-- Safety RLS only exposes referred damage_reports; this SECURITY DEFINER
-- RPC returns intentional overview counts after a role check.

create or replace function public.safety_home_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select role into caller_role
  from public.profiles
  where id = (select auth.uid());

  if caller_role is distinct from 'safety'
     and caller_role is distinct from 'admin' then
    raise exception 'Not authorized';
  end if;

  return jsonb_build_object(
    'total_reports',
    (select count(*)::integer from public.damage_reports),
    'pending_review',
    (
      select count(*)::integer
      from public.safety_inbox_items
      where status = 'pending'
    ),
    'reports_24h',
    (
      select count(*)::integer
      from public.damage_reports
      where created_at >= (now() - interval '24 hours')
    ),
    'reports_30d',
    (
      select count(*)::integer
      from public.damage_reports
      where created_at >= (now() - interval '30 days')
    )
  );
end;
$$;

comment on function public.safety_home_stats() is
  'Returns fleet damage report totals + pending Safety inbox count for safety/admin Home.';

revoke execute on function public.safety_home_stats()
  from public, anon;
grant execute on function public.safety_home_stats()
  to authenticated, service_role;
