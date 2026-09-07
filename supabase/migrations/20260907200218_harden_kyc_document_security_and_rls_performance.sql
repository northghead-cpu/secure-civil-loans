CREATE OR REPLACE FUNCTION public.is_valid_kyc_storage_object_name(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT object_name ~* '^(nrc|gov-id|payslip|introductory-letter)-[0-9]{13}\.(pdf|png|jpe?g)$'
$$;

CREATE OR REPLACE FUNCTION public.current_application_date()
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CURRENT_DATE;
$$;

REVOKE ALL ON FUNCTION public.current_application_date() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_application_date() TO authenticated;

DROP POLICY IF EXISTS "Users can view own KYC documents" ON public.kyc_documents;
CREATE POLICY "Users can view own KYC documents"
ON public.kyc_documents FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own pending KYC documents" ON public.kyc_documents;
CREATE POLICY "Users can create own pending KYC documents"
ON public.kyc_documents FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id AND validation_status = 'PENDING');

DROP POLICY IF EXISTS "Users cannot update KYC validation state" ON public.kyc_documents;
CREATE POLICY "Users cannot update KYC validation state"
ON public.kyc_documents FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id AND validation_status = 'PENDING')
WITH CHECK ((select auth.uid()) = user_id AND validation_status = 'PENDING');
