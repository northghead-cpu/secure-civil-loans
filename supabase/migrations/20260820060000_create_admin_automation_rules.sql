create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  trigger text not null,
  action text not null,
  enabled boolean not null default false,
  run_count integer not null default 0 check (run_count >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.automation_rules enable row level security;

create policy automation_rules_select_admin on public.automation_rules
for select to authenticated
using (private.has_role('admin') or private.has_role('super_admin') or private.has_role('super_user') or private.has_role('compliance_team') or private.has_role('data_entry_team'));

create policy automation_rules_insert_super_admin on public.automation_rules
for insert to authenticated
with check (private.has_role('super_admin'));

create policy automation_rules_update_super_admin on public.automation_rules
for update to authenticated
using (private.has_role('super_admin'))
with check (private.has_role('super_admin'));

create policy automation_rules_delete_super_admin on public.automation_rules
for delete to authenticated
using (private.has_role('super_admin'));
