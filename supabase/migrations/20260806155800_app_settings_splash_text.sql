-- Site-wide key/value settings (admin-editable splash copy, etc.).

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint app_settings_key_len check (char_length(key) between 1 and 64),
  constraint app_settings_value_len check (char_length(value) <= 2000)
);

comment on table public.app_settings is
  'Shared site settings (key/value). Admin writes; anyone may read public keys.';
comment on column public.app_settings.key is
  'Stable setting id, e.g. splash_text.';
comment on column public.app_settings.value is
  'Setting payload as text (max 2000 chars).';

insert into public.app_settings (key, value)
values (
  'splash_text',
  'PrivateFleet helps private-fleet drivers log loads and report trailer and tractor damage — with Safety review when you need it.'
)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all"
  on public.app_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "app_settings_insert_admin" on public.app_settings;
create policy "app_settings_insert_admin"
  on public.app_settings for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
  on public.app_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "app_settings_delete_admin" on public.app_settings;
create policy "app_settings_delete_admin"
  on public.app_settings for delete
  to authenticated
  using ((select public.is_admin()));

grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;
grant select, insert, update, delete on public.app_settings to service_role;
