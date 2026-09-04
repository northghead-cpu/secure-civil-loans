-- Reconciliation control-plane tables are service-role/internal data.
-- RLS is enabled and no client policies are defined; remove the one
-- accidental authenticated-table grant so the privilege model is explicit.

revoke all on table public.edge_request_log from anon, authenticated;
revoke all on table public.reconciliation_checks from anon, authenticated;
revoke all on table public.reconciliation_findings from anon, authenticated;
revoke all on table public.reconciliation_runs from anon, authenticated;
