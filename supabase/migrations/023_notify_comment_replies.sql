-- Notify parent-comment authors when someone replies to their comment.
-- Reuses type report_comment (Feed badge / mark-read already cover it).
-- Top-level comments still notify the report owner (existing behavior).

create or replace function public.notify_report_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_owner uuid;
  parent_author uuid;
  asset_label text;
  asset_num text;
  snippet text;
  asset_prefix text;
begin
  select reported_by, asset_type::text, asset_number
    into report_owner, asset_label, asset_num
  from public.damage_reports
  where id = new.damage_report_id;

  snippet := left(trim(new.body), 120);
  asset_prefix :=
    initcap(coalesce(asset_label, 'asset')) || ' ' || coalesce(asset_num, '');

  if new.parent_id is not null then
    select author_id into parent_author
    from public.damage_report_comments
    where id = new.parent_id;

    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications (
        user_id, type, title, body, damage_report_id, actor_id
      ) values (
        parent_author,
        'report_comment',
        'New reply to your comment',
        asset_prefix
          || case when snippet <> '' then ': ' || snippet else '' end,
        new.damage_report_id,
        new.author_id
      );
    end if;
  end if;

  -- Report owner: top-level replies, or nested replies when owner is not
  -- already notified as the parent author.
  if report_owner is not null
     and report_owner <> new.author_id
     and (parent_author is null or report_owner <> parent_author) then
    insert into public.notifications (
      user_id, type, title, body, damage_report_id, actor_id
    ) values (
      report_owner,
      'report_comment',
      'New reply on your report',
      asset_prefix
        || case when snippet <> '' then ': ' || snippet else '' end,
      new.damage_report_id,
      new.author_id
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_report_comment() from public, anon, authenticated;
