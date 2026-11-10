-- Phase 8 defense-in-depth: revoke unneeded anon privileges.
-- RLS already blocks these paths; removing grants removes the attack surface entirely.
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.edge_request_log FROM anon;
REVOKE ALL ON public.payroll_deduction_authorizations FROM anon;