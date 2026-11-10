-- These are trusted outputs/legacy records, not applicant input surfaces.
-- The browser only reads them. process-loan writes scoring outputs using the
-- service role after remote identity, AAL2 and database-role verification.
REVOKE INSERT, UPDATE, DELETE ON public.loan_results FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.underwriting_queue FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kyc FROM anon, authenticated;

DROP POLICY IF EXISTS loan_results_insert ON public.loan_results;
DROP POLICY IF EXISTS loan_results_admin_update ON public.loan_results;
DROP POLICY IF EXISTS loan_results_admin_delete ON public.loan_results;
DROP POLICY IF EXISTS "Users can insert own kyc" ON public.kyc;
DROP POLICY IF EXISTS "Users can update own kyc" ON public.kyc;
