create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  audit_log_id uuid not null references public.audit_logs(id) on delete restrict,
  action_performed text not null check (char_length(action_performed) between 1 and 160),
  table_name text,
  record_id text,
  actor_user_id uuid references auth.users(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint incident_actions_incident_audit_unique unique (incident_id, audit_log_id)
);

create index if not exists idx_incident_actions_incident_id on public.incident_actions(incident_id);
create index if not exists idx_incident_actions_audit_log_id on public.incident_actions(audit_log_id);
create index if not exists idx_incident_actions_occurred_at on public.incident_actions(occurred_at desc);

alter table public.incident_actions enable row level security;

revoke all on public.incident_actions from anon, authenticated;
grant select on public.incident_actions to authenticated;

drop policy if exists incident_actions_admin_select on public.incident_actions;
create policy incident_actions_admin_select
on public.incident_actions
for select
to authenticated
using (private.has_any_role('admin','super_admin'));

create or replace function public.record_incident_action(
  p_incident_id uuid,
  p_audit_log_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_action_id uuid;
  v_log public.audit_logs%rowtype;
begin
  if p_incident_id is null or p_audit_log_id is null then
    raise exception 'incident_id and audit_log_id are required';
  end if;

  select * into v_log
  from public.audit_logs
  where id = p_audit_log_id;

  if not found then
    raise exception 'audit log not found';
  end if;

  if not exists (select 1 from public.incidents where id = p_incident_id) then
    raise exception 'incident not found';
  end if;

  insert into public.incident_actions (
    incident_id,
    audit_log_id,
    action_performed,
    table_name,
    record_id,
    actor_user_id,
    occurred_at
  ) values (
    p_incident_id,
    p_audit_log_id,
    left(v_log.action_performed, 160),
    v_log.table_name,
    v_log.record_id,
    v_log.user_id,
    v_log.created_at
  )
  on conflict (incident_id, audit_log_id) do nothing
  returning id into v_action_id;

  return v_action_id;
end;
$$;

revoke execute on function public.record_incident_action(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_incident_action(uuid, uuid) to service_role;

comment on table public.incident_actions is 'Incident-specific action index. Contains concise action metadata only; full audit details remain exclusively in audit_logs.';
comment on column public.incident_actions.audit_log_id is 'Authoritative source for full event details; this table intentionally does not copy old_value or new_value.';
