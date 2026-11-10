-- 1. Revoke EXECUTE from anon and public on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_connection() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calculate_zmw_underwriting(numeric, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;

-- 2. Ensure authenticated can still call the functions they need
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_connection() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_zmw_underwriting(numeric, numeric) TO authenticated;

-- 3. Fix overly permissive notifications INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);