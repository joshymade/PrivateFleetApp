-- At most one active load per assigned driver (profile id).
-- Unassigned active loads are allowed (assigned_driver_id is null).

-- Deduplicate before unique index: keep newest active per driver; complete the rest.
with ranked as (
  select
    id,
    row_number() over (
      partition by assigned_driver_id
      order by created_at desc, id desc
    ) as rn
  from public.loads
  where status = 'active'
    and assigned_driver_id is not null
)
update public.loads l
set
  status = 'completed',
  trailer_number = null,
  updated_at = now()
from ranked r
where l.id = r.id
  and r.rn > 1;

create unique index if not exists loads_one_active_per_driver_uidx
  on public.loads (assigned_driver_id)
  where status = 'active'
    and assigned_driver_id is not null;

comment on index public.loads_one_active_per_driver_uidx is
  'Enforces one active load per assigned driver; complete before starting another.';
