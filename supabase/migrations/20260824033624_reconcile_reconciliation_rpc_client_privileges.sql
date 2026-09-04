REVOKE EXECUTE ON FUNCTION public.run_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_reconciliation_test_finding(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_reconciliation_finding_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_reconciliation() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_reconciliation_test_finding(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_reconciliation_finding_status(uuid, text) TO service_role;
