-- Restore the missing check_connection function baseline that exists in
-- production but was absent from the repository migration chain.
--
-- This must precede 20260504082320, which revokes/grants EXECUTE on the
-- function before 20260504082338 later replaces its implementation.

CREATE OR REPLACE FUNCTION public.check_connection()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN json_build_object(
    'status', 'connected',
    'timestamp', now(),
    'user_id', auth.uid(),
    'role_check', (SELECT count(*) FROM public.user_roles WHERE user_id = auth.uid())
  );
END;
$function$;
