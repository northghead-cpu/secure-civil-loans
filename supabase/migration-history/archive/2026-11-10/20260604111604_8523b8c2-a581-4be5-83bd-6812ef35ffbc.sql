
CREATE TABLE public.payroll_deduction_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_application_id uuid REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  agreement_version text NOT NULL,
  agreement_text text NOT NULL,
  signature_name text NOT NULL,
  signer_full_name text,
  signer_nrc text,
  signer_employer text,
  signer_employee_number text,
  authorized_amount numeric,
  authorized_term_months integer,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.payroll_deduction_authorizations TO authenticated;
GRANT ALL ON public.payroll_deduction_authorizations TO service_role;

ALTER TABLE public.payroll_deduction_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own authorization"
  ON public.payroll_deduction_authorizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own authorization"
  ON public.payroll_deduction_authorizations FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'compliance_team')
  );

CREATE INDEX idx_pda_user ON public.payroll_deduction_authorizations(user_id);
CREATE INDEX idx_pda_app ON public.payroll_deduction_authorizations(loan_application_id);

-- Block payout inserts/updates that would disburse without an active signed authorization
CREATE OR REPLACE FUNCTION public.require_payroll_authorization_for_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user uuid;
  has_auth boolean;
BEGIN
  IF NEW.status IN ('disbursed','processing','sent','paid') THEN
    SELECT user_id INTO app_user FROM public.loan_applications WHERE id = NEW.loan_application_id;
    IF app_user IS NULL THEN
      RAISE EXCEPTION 'Payout references unknown loan application';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.payroll_deduction_authorizations
      WHERE user_id = app_user
        AND status = 'active'
        AND revoked_at IS NULL
        AND (loan_application_id = NEW.loan_application_id OR loan_application_id IS NULL)
    ) INTO has_auth;

    IF NOT has_auth THEN
      RAISE EXCEPTION 'Cannot disburse: no active signed payroll deduction authorization on file for this borrower';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_payroll_auth ON public.payouts;
CREATE TRIGGER trg_require_payroll_auth
  BEFORE INSERT OR UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.require_payroll_authorization_for_payout();
