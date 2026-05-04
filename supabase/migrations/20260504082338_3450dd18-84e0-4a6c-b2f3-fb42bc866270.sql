CREATE OR REPLACE FUNCTION public.check_connection()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
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

-- Revoke from anon since it's not needed by unauthenticated users
REVOKE EXECUTE ON FUNCTION public.check_connection() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_connection() TO authenticated;