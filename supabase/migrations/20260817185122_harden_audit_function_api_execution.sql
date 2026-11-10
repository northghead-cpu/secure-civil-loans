REVOKE EXECUTE ON FUNCTION public.audit_bank_product_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_granular_consent_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_kyc_write_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_loan_application_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_loan_application_changes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_user_role_change() FROM anon, authenticated;
ALTER FUNCTION public.is_valid_kyc_storage_object_name(text) SET search_path = public, pg_temp;
