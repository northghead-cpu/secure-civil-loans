-- Reconciliation and request-log tables are service-role-only runtime surfaces.
-- Remove client-role privileges explicitly so browser clients cannot read or mutate
-- operational reconciliation data even when RLS is enabled.

REVOKE ALL ON TABLE public.edge_request_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.reconciliation_checks FROM anon, authenticated;
REVOKE ALL ON TABLE public.reconciliation_findings FROM anon, authenticated;
REVOKE ALL ON TABLE public.reconciliation_runs FROM anon, authenticated;
