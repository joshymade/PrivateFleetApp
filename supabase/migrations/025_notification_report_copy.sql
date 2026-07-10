-- User-facing notification copy: "referral" → "report".
-- Keeps enum/type inbox_referral and function names unchanged.

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

  -- Notify the driver who sent the report when Safety updates status.
  if new.sent_by is not null
     and (new.reviewed_by is null or new.reviewed_by <> new.sent_by) then
    insert into public.notifications (
      user_id, type, title, body,
      damage_report_id, safety_inbox_item_id, actor_id
    ) values (
      new.sent_by,
      'inbox_status',
      'Safety inbox update',
      'Your report is now ' || new.status,
      new.damage_report_id,
      new.id,
      new.reviewed_by
    );
  end if;

  return new;
end;
$$;

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
      'New Safety report',
      initcap(coalesce(asset_label, 'asset')) || ' ' || coalesce(asset_num, ''),
      new.damage_report_id,
      new.id,
      new.sent_by
    );
  end loop;

  return new;
end;
$$;

-- Rewrite existing stored notification strings.
update public.notifications
set body = replace(body, 'Your referral is now ', 'Your report is now ')
where body like 'Your referral is now %';

update public.notifications
set title = 'New Safety report'
where title = 'New Safety referral';
