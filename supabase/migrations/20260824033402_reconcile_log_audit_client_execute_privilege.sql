REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) TO service_role;
