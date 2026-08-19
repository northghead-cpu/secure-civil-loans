-- Incidents are intentionally separate from audit_logs.
-- audit_logs retains the complete system audit trail; incidents expose only
-- operational action summaries needed by Riverbanc Admin.

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'detected'
    check (status in ('detected', 'acknowledged', 'investigating', 'resolved')),
  summary text not null,
  correlation_id text,
  source text not null default 'application',
  audit_log_id uuid references public.audit_logs(id) on delete set null,
  occurred_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  investigating_at timestamptz,
  investigating_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_summary_length check (char_length(summary) between 1 and 240),
  constraint incidents_operation_length check (char_length(operation) between 1 and 80),
  constraint incidents_correlation_length check (correlation_id is null or char_length(correlation_id) <= 128)
);

create index if not exists incidents_status_severity_idx
  on public.incidents (status, severity, occurred_at desc);

create index if not exists incidents_operation_idx
  on public.incidents (operation, occurred_at desc);

create index if not exists incidents_correlation_id_idx
  on public.incidents (correlation_id)
  where correlation_id is not null;

alter table public.incidents enable row level security;

create policy "incidents_admin_select"
  on public.incidents
  for select
  to authenticated
  using (public.has_any_role('admin', 'super_admin'));

create policy "incidents_admin_update"
  on public.incidents
  for update
  to authenticated
  using (public.has_any_role('admin', 'super_admin'))
  with check (public.has_any_role('admin', 'super_admin'));

revoke insert, delete on public.incidents from authenticated, anon;
grant select, update on public.incidents to authenticated;

-- Incident records intentionally contain no user NRC, salary, raw provider
-- payload, application details, or other audit-log payloads.