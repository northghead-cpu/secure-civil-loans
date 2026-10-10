-- Riverbanc production access-control hardening.
-- Preserve existing product flows while reducing database privileges and restoring intended RLS access.
BEGIN;

-- Remove privileges that bypass RLS or permit structural/object-level changes.
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- Make future objects secure by default. New app-facing objects must receive explicit grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Restrict profile writes to fields used by the existing KYC and consent flows.
-- Sensitive status fields remain writable for authorized admins, but existing RLS/trigger checks still apply.
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

-- Prevent privilege/status forgery when a signed-in user inserts their own profile.
-- Existing UPDATE triggers remain unchanged.
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

-- Restore intended admin user-management access; the existing restrictive MFA policy still gates privileged sessions.
DROP POLICY IF EXISTS profiles_admin_select_policy ON public.profiles;
CREATE POLICY profiles_admin_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'));

DROP POLICY IF EXISTS profiles_admin_update_policy ON public.profiles;
CREATE POLICY profiles_admin_update_policy ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- Members can submit and read their own applications. Authorized staff can read applications for existing admin workflows.
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
