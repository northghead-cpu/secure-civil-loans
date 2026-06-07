
-- 1. user_roles: prevent privilege escalation
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'super_admin'::app_role))
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role AND role <> 'admin'::app_role)
  );

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role AND role <> 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role AND role <> 'admin'::app_role)
  );

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role AND role <> 'admin'::app_role)
  );

-- 2. payroll_deduction_authorizations: allow admin revocation (UPDATE only, no DELETE for tamper-proofing)
CREATE POLICY "Admins can revoke authorizations" ON public.payroll_deduction_authorizations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'compliance_team'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'compliance_team'::app_role));

COMMENT ON TABLE public.payroll_deduction_authorizations IS 'Immutable e-sign records. DELETE intentionally not permitted (tamper-proof compliance trail). Use UPDATE to set revoked_at/status when revoking.';

-- 3. loan_applications: enforce sanitize on UPDATE + add WITH CHECK
DROP POLICY IF EXISTS "Admins can update applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Super users can update applications" ON public.loan_applications;

CREATE POLICY "Admins can update applications" ON public.loan_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super users can update applications" ON public.loan_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_user'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_user'::app_role));

CREATE OR REPLACE FUNCTION public.sanitize_loan_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    NEW.decision := OLD.decision;
    NEW.decision_reason := OLD.decision_reason;
    NEW.fraud_flag := OLD.fraud_flag;
    NEW.fraud_score := OLD.fraud_score;
    NEW.underwriting_score := OLD.underwriting_score;
    NEW.verification_passed := OLD.verification_passed;
    NEW.verification_notes := OLD.verification_notes;
    NEW.credit_score := OLD.credit_score;
    NEW.crb_status := OLD.crb_status;
    NEW.admin_notes := OLD.admin_notes;
    NEW.risk_level := OLD.risk_level;
    NEW.interest_rate := OLD.interest_rate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_loan_application_update_trg ON public.loan_applications;
CREATE TRIGGER sanitize_loan_application_update_trg
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_loan_application_update();

DROP TRIGGER IF EXISTS sanitize_loan_application_insert_trg ON public.loan_applications;
CREATE TRIGGER sanitize_loan_application_insert_trg
  BEFORE INSERT ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_loan_application_insert();

-- 4. audit_logs: drop user-controlled INSERT policy. Writes go through log_audit (SECURITY DEFINER) and triggers.
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

-- 5. Tighten protect_profile_security_fields: remove data_entry_team
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    NEW.kyc_status     := OLD.kyc_status;
    NEW.nrc_verified   := OLD.nrc_verified;
    NEW.phone_verified := OLD.phone_verified;
    NEW.account_status := OLD.account_status;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/public
REVOKE EXECUTE ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_consent_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_payroll_authorization_for_payout() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_loan_application_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_loan_application_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_kyc_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_consent_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_kyc_table_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
