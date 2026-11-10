create index if not exists idx_incidents_audit_log_id on public.incidents (audit_log_id);
create index if not exists idx_reconciliation_findings_check_id on public.reconciliation_findings (check_id);
create index if not exists idx_incident_actions_actor_user_id on public.incident_actions (actor_user_id);
