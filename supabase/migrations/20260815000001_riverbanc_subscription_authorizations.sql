-- Riverbanc subscription authorization ledger
-- This records the borrower's authorization for the K60/month Riverbanc platform subscription.
-- Payroll_status deliberately starts as PENDING: this is an authorization record, not proof that a payroll deduction has occurred.

CREATE TABLE public.subscription_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 60.00 CHECK (amount = 60.00),
  currency text NOT NULL DEFAULT 'ZMW' CHECK (currency = 'ZMW'),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency = 'monthly'),
  deduction_method text NOT NULL DEFAULT 'payroll' CHECK (deduction_method = 'payroll'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  payroll_status text NOT NULL DEFAULT 'pending' CHECK (payroll_status IN ('pending', 'submitted', 'confirmed', 'failed')),
  signed_name text NOT NULL,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_authorizations_user_id_idx ON public.subscription_authorizations(user_id);
CREATE UNIQUE INDEX one_active_subscription_authorization_per_user
  ON public.subscription_authorizations(user_id)
  WHERE status = 'active';

ALTER TABLE public.subscription_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription authorization"
ON public.subscription_authorizations
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view subscription authorizations"
ON public.subscription_authorizations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'super_user'::app_role) OR
  has_role(auth.uid(), 'compliance_team'::app_role)
);

CREATE OR REPLACE FUNCTION public.authorize_riverbanc_subscription(_signed_name text)
RETURNS public.subscription_authorizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.subscription_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF length(trim(coalesce(_signed_name, ''))) < 2 THEN
    RAISE EXCEPTION 'A valid signature name is required';
  END IF;

  UPDATE public.subscription_authorizations
  SET status = 'revoked', revoked_at = now(), updated_at = now()
  WHERE user_id = auth.uid() AND status = 'active';

  INSERT INTO public.subscription_authorizations (
    user_id, signed_name, amount, currency, frequency, deduction_method, status, payroll_status
  )
  VALUES (
    auth.uid(), trim(_signed_name), 60.00, 'ZMW', 'monthly', 'payroll', 'active', 'pending'
  )
  RETURNING * INTO result;

  PERFORM public.log_audit(
    auth.uid(), 'borrower', 'subscription_authorized', result.id::text,
    'subscription_authorizations', NULL,
    jsonb_build_object(
      'amount', result.amount,
      'currency', result.currency,
      'frequency', result.frequency,
      'deduction_method', result.deduction_method,
      'payroll_status', result.payroll_status,
      'authorized_at', result.authorized_at
    )
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_riverbanc_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_riverbanc_subscription(text) TO authenticated;
