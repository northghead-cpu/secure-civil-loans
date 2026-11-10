create table if not exists public.incident_event_rules (
  id uuid primary key default gen_random_uuid(),
  action_pattern text not null check (char_length(action_pattern) between 1 and 160),
  classification text not null check (classification in ('audit_only','incident_eligible','critical_incident')),
  default_severity text check (default_severity is null or default_severity in ('critical','high','medium','low')),
  description text not null check (char_length(description) between 1 and 240),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (action_pattern)
);

alter table public.incident_event_rules enable row level security;

create policy incident_event_rules_admin_read on public.incident_event_rules
for select to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin'::app_role, 'super_admin'::app_role)));

revoke insert, update, delete on public.incident_event_rules from anon, authenticated;
grant select on public.incident_event_rules to authenticated;

insert into public.incident_event_rules (action_pattern, classification, default_severity, description)
values
('login_failed', 'audit_only', null, 'Single failed authentication attempt is retained in the audit trail.'),
('unauthorized_access', 'incident_eligible', 'high', 'Access attempt denied because the actor lacks authorization.'),
('rls_violation', 'incident_eligible', 'high', 'Database row-level security prevented an unauthorized operation.'),
('role_escalation_attempt', 'critical_incident', 'critical', 'Attempt to obtain or assign privileges beyond the actor authorization.'),
('protected_record_modification_attempt', 'incident_eligible', 'high', 'Attempt to modify a protected or immutable record.'),
('tamper_attempt', 'critical_incident', 'critical', 'Detected attempt to tamper with protected system or compliance records.'),
('privileged_operation_failed', 'incident_eligible', 'medium', 'Privileged operation failed and requires operational/security review.'),
('security_configuration_change', 'incident_eligible', 'high', 'Security-sensitive configuration was changed.'),
('suspicious_handoff', 'incident_eligible', 'medium', 'Application handoff activity triggered a security or integrity concern.'),
('api_abuse_detected', 'incident_eligible', 'high', 'Abnormal or abusive API behavior was detected.'),
('data_integrity_violation', 'critical_incident', 'critical', 'System detected a potential data-integrity violation.')
on conflict (action_pattern) do nothing;
