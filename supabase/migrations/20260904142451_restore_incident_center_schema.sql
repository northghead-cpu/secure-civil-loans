-- Restore the Incident Center schema when migration history says it exists but the
-- production object is absent. This is deliberately idempotent for safe replay.

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'detected' check (status in ('detected', 'acknowledged', 'investigating', 'resolved')),
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

create index if not exists incidents_status_severity_idx on public.incidents (status, severity, occurred_at desc);
create index if not exists incidents_operation_idx on public.incidents (operation, occurred_at desc);
create index if not exists incidents_correlation_id_idx on public.incidents (correlation_id) where correlation_id is not null;

alter table public.incidents enable row level security;

drop policy if exists "incidents_admin_select" on public.incidents;
create policy "incidents_admin_select" on public.incidents for select to authenticated using (private.has_any_role('admin', 'super_admin'));

drop policy if exists "incidents_admin_update" on public.incidents;
create policy "incidents_admin_update" on public.incidents for update to authenticated using (private.has_any_role('admin', 'super_admin')) with check (private.has_any_role('admin', 'super_admin'));

revoke insert, delete on public.incidents from authenticated, anon;
grant select, update on public.incidents to authenticated;
