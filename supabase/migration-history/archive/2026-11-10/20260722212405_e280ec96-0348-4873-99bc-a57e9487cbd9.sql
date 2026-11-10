
-- =========================================================================
-- H-01: Fix user_roles privilege recon
-- =========================================================================
DROP POLICY IF EXISTS "New roles can read own roles" ON public.user_roles;
-- Existing policy "Admins can read all roles" already covers admins + auth.uid() = user_id.

-- =========================================================================
-- M-01 / L-01: Harden log_audit; revoke calculate_zmw_underwriting
-- =========================================================================
CREATE OR REPLACE FUNCTION public.log_audit(
  _user_id uuid,
  _role text,
  _action text,
  _record_id text DEFAULT NULL::text,
  _table_name text DEFAULT NULL::text,
  _old_value jsonb DEFAULT NULL::jsonb,
  _new_value jsonb DEFAULT NULL::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_is_admin boolean := caller IS NOT NULL AND (
    public.has_role(caller, 'admin'::app_role) OR
    public.has_role(caller, 'super_admin'::app_role)
  );
  effective_user uuid;
  effective_role text;
BEGIN
  -- Non-admin callers may only log actions for themselves.
  IF caller IS NULL THEN
    RAISE EXCEPTION 'log_audit requires an authenticated caller';
  END IF;
  IF NOT caller_is_admin AND _user_id IS DISTINCT FROM caller THEN
    RAISE EXCEPTION 'not authorized to write audit entries for another user';
  END IF;

  effective_user := COALESCE(_user_id, caller);
  -- Derive role from user_roles table; ignore client-supplied _role unless caller is admin.
  effective_role := COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = caller LIMIT 1),
    CASE WHEN caller_is_admin THEN _role ELSE 'user' END
  );

  INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  VALUES (effective_user, effective_role, _action, _record_id, _table_name, _old_value, _new_value);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_zmw_underwriting(numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_zmw_underwriting(numeric, numeric) TO service_role;

-- =========================================================================
-- M-04: DB-backed nonce store + rate-limit source of truth
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.edge_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS edge_request_log_nonce_uniq
  ON public.edge_request_log (user_id, function_name, nonce);

CREATE INDEX IF NOT EXISTS edge_request_log_recent
  ON public.edge_request_log (user_id, function_name, created_at DESC);

GRANT ALL ON public.edge_request_log TO service_role;

ALTER TABLE public.edge_request_log ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: table is service_role-only. service_role bypasses RLS.
