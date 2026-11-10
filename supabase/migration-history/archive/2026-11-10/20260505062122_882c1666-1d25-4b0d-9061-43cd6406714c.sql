-- Trigger function to strip admin-only fields on user INSERT into loan_applications
CREATE OR REPLACE FUNCTION public.sanitize_loan_application_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If the inserting user is NOT an admin/super_admin, force admin fields to defaults
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  ) THEN
    NEW.decision := NULL;
    NEW.decision_reason := NULL;
    NEW.fraud_flag := NULL;
    NEW.fraud_score := NULL;
    NEW.underwriting_score := NULL;
    NEW.verification_passed := NULL;
    NEW.verification_notes := NULL;
    NEW.credit_score := NULL;
    NEW.crb_status := NULL;
    NEW.admin_notes := NULL;
    NEW.risk_level := NULL;
    NEW.interest_rate := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke from anon/public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.sanitize_loan_application_insert() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sanitize_loan_application_insert() TO authenticated;

-- Add trigger
DROP TRIGGER IF EXISTS trg_sanitize_loan_application_insert ON public.loan_applications;
CREATE TRIGGER trg_sanitize_loan_application_insert
  BEFORE INSERT ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_loan_application_insert();