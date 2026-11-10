REVOKE EXECUTE ON FUNCTION private.authorize_riverbanc_subscription_internal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.authorize_riverbanc_subscription_internal(uuid, text) TO service_role;
