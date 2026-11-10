ALTER FUNCTION public.has_any_role(text[]) SET SCHEMA private;
ALTER FUNCTION public.has_role(text) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
REVOKE EXECUTE ON FUNCTION private.has_any_role(text[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_role(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated;
