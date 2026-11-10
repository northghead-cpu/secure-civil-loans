create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

create policy system_settings_admin_read on public.system_settings
for select to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::app_role)) or (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

create policy system_settings_super_admin_write on public.system_settings
for all to authenticated
using ((select private.has_role((select auth.uid()), 'super_admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
