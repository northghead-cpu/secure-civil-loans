-- Prevent ordinary authenticated clients from manufacturing audit events.
revoke execute on function public.log_audit(uuid, text, text, text, text, jsonb, jsonb) from authenticated;
