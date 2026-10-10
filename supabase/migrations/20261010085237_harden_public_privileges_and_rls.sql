-- Riverbanc production access-control hardening.
-- This migration runs as the postgres role; Supabase-managed supabase_admin default ACLs
-- require owner-level access unavailable to the deployment connection and are not modified here.
BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

REVOKE INSERT, UPDATE ON TABLE public.profiles FROM authenticated;
GRANT INSERT (
  user_id, full_name, phone, nrc_number, employer, employee_number,
  kyc_status, consent_accepted, updated_at
) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (
  user_id, full_name, phone, nrc_number, employer, employee_number,
  kyc_status, consent_accepted, updated_at,
  consent_marketing, consent_data_sharing_lenders, consent_crb_check, consent_analytics,
  account_status, nrc_verified, phone_verified
) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_profile_insert_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
    NEW.role := 'user';
    NEW.account_status := 'active';
    NEW.nrc_verified := false;
    NEW.phone_verified := false;
    NEW.consent_signed_at := NULL;
    NEW.consents_updated_at := NULL;
    IF NEW.kyc_status IS NULL OR NEW.kyc_status NOT IN ('INCOMPLETE', 'PENDING', 'IN_REVIEW') THEN
      NEW.kyc_status := 'INCOMPLETE';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_profile_insert_security_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_profile_insert_security_fields ON public.profiles;
CREATE TRIGGER trg_enforce_profile_insert_security_fields
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_insert_security_fields();

DROP POLICY IF EXISTS loan_applications_select_own_or_staff ON public.loan_applications;
CREATE POLICY loan_applications_select_own_or_staff ON public.loan_applications
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.has_role('admin')
    OR private.has_role('super_admin')
    OR private.has_role('compliance_team')
    OR private.has_role('super_user')
  );
DROP POLICY IF EXISTS loan_applications_insert_own ON public.loan_applications;
CREATE POLICY loan_applications_insert_own ON public.loan_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
