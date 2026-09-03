-- Riverbanc monthly payroll receipt ledger
-- Payment is only represented as PAID after subscription_authorizations.payroll_status = confirmed.

CREATE SEQUENCE IF NOT EXISTS public.payment_receipt_number_seq;

CREATE TABLE public.billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_date date NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Lusaka' CHECK (timezone = 'Africa/Lusaka'),
  amount numeric(12,2) NOT NULL DEFAULT 60.00 CHECK (amount = 60.00),
  currency text NOT NULL DEFAULT 'ZMW' CHECK (currency = 'ZMW'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','partial','failed')),
  eligible_count integer NOT NULL DEFAULT 0,
  confirmed_count integer NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  receipt_count integer NOT NULL DEFAULT 0,
  delivery_failure_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end = period_start + interval '1 month' - interval '1 day')
);

CREATE TABLE public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_run_id uuid NOT NULL REFERENCES public.billing_runs(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 60.00 CHECK (amount = 60.00),
  currency text NOT NULL DEFAULT 'ZMW' CHECK (currency = 'ZMW'),
  payment_method text NOT NULL DEFAULT 'payroll' CHECK (payment_method = 'payroll'),
  payroll_reference text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','void')),
  confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start),
  UNIQUE (billing_run_id, user_id)
);

CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_transaction_id uuid NOT NULL UNIQUE REFERENCES public.billing_transactions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  receipt_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text,
  amount numeric(12,2) NOT NULL DEFAULT 60.00 CHECK (amount = 60.00),
  currency text NOT NULL DEFAULT 'ZMW' CHECK (currency = 'ZMW'),
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  payment_method text NOT NULL DEFAULT 'payroll' CHECK (payment_method = 'payroll'),
  payroll_reference text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  document_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.receipt_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('dashboard','email')),
  status text NOT NULL CHECK (status IN ('available','pending','sent','failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receipt_id, channel)
);

CREATE INDEX billing_transactions_user_period_idx ON public.billing_transactions(user_id, period_start DESC);
CREATE INDEX payment_receipts_user_issued_idx ON public.payment_receipts(user_id, issued_at DESC);
CREATE INDEX receipt_deliveries_pending_idx ON public.receipt_deliveries(status, channel, updated_at);

ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment receipts"
ON public.payment_receipts FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own billing transactions"
ON public.billing_transactions FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own receipt deliveries"
ON public.receipt_deliveries FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.payment_receipts r
  WHERE r.id = receipt_id AND r.user_id = (select auth.uid())
));

CREATE POLICY "Admins can view billing runs"
ON public.billing_runs FOR SELECT TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role) OR
  has_role((select auth.uid()), 'super_admin'::app_role) OR
  has_role((select auth.uid()), 'super_user'::app_role) OR
  has_role((select auth.uid()), 'compliance_team'::app_role)
);

CREATE POLICY "Admins can view all billing transactions"
ON public.billing_transactions FOR SELECT TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role) OR
  has_role((select auth.uid()), 'super_admin'::app_role) OR
  has_role((select auth.uid()), 'super_user'::app_role) OR
  has_role((select auth.uid()), 'compliance_team'::app_role)
);

CREATE POLICY "Admins can view all payment receipts"
ON public.payment_receipts FOR SELECT TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role) OR
  has_role((select auth.uid()), 'super_admin'::app_role) OR
  has_role((select auth.uid()), 'super_user'::app_role) OR
  has_role((select auth.uid()), 'compliance_team'::app_role)
);

CREATE POLICY "Admins can view all receipt deliveries"
ON public.receipt_deliveries FOR SELECT TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role) OR
  has_role((select auth.uid()), 'super_admin'::app_role) OR
  has_role((select auth.uid()), 'super_user'::app_role) OR
  has_role((select auth.uid()), 'compliance_team'::app_role)
);

REVOKE INSERT, UPDATE, DELETE ON public.billing_runs FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.billing_transactions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.payment_receipts FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.receipt_deliveries FROM authenticated, anon;

CREATE OR REPLACE FUNCTION private.run_riverbanc_monthly_billing(_billing_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.billing_runs;
  v_period_end date;
  v_sub record;
  v_tx public.billing_transactions;
  v_receipt public.payment_receipts;
  v_created integer := 0;
  v_receipts integer := 0;
  v_eligible integer := 0;
BEGIN
  IF _billing_date IS NULL OR EXTRACT(DAY FROM _billing_date) <> 23 THEN
    RAISE EXCEPTION 'Billing date must be the 23rd of a month';
  END IF;

  v_period_end := (_billing_date + interval '1 month' - interval '1 day')::date;

  INSERT INTO public.billing_runs (billing_date, period_start, period_end, status, started_at)
  VALUES (_billing_date, _billing_date, v_period_end, 'running', now())
  ON CONFLICT (billing_date) DO UPDATE
    SET status = CASE WHEN public.billing_runs.status = 'completed' THEN public.billing_runs.status ELSE 'running' END,
        started_at = CASE WHEN public.billing_runs.status = 'completed' THEN public.billing_runs.started_at ELSE now() END,
        updated_at = now()
  RETURNING * INTO v_run;

  IF v_run.status = 'completed' THEN
    RETURN jsonb_build_object('billing_run_id', v_run.id, 'status', v_run.status, 'transactions', v_run.transaction_count, 'receipts', v_run.receipt_count, 'idempotent', true);
  END IF;

  SELECT count(*) INTO v_eligible
  FROM public.subscription_authorizations sa
  WHERE sa.status = 'active';

  FOR v_sub IN
    SELECT sa.user_id, sa.payroll_reference, sa.payroll_confirmed_at, p.full_name, p.email
    FROM public.subscription_authorizations sa
    JOIN public.profiles p ON p.user_id = sa.user_id
    WHERE sa.status = 'active'
      AND sa.payroll_status = 'confirmed'
  LOOP
    BEGIN
      INSERT INTO public.billing_transactions (
        billing_run_id, user_id, period_start, period_end, amount, currency,
        payment_method, payroll_reference, status, confirmed_at
      ) VALUES (
        v_run.id, v_sub.user_id, _billing_date, v_period_end, 60.00, 'ZMW',
        'payroll', v_sub.payroll_reference, 'confirmed',
        coalesce(v_sub.payroll_confirmed_at, now())
      )
      ON CONFLICT (user_id, period_start) DO NOTHING
      RETURNING * INTO v_tx;

      IF v_tx.id IS NULL THEN
        CONTINUE;
      END IF;

      v_created := v_created + 1;

      INSERT INTO public.payment_receipts (
        billing_transaction_id, user_id, receipt_number, customer_name, customer_email,
        amount, currency, billing_period_start, billing_period_end,
        payment_method, payroll_reference
      ) VALUES (
        v_tx.id,
        v_sub.user_id,
        'RB-' || to_char(_billing_date, 'YYYYMM') || '-' || lpad(nextval('public.payment_receipt_number_seq')::text, 8, '0'),
        coalesce(nullif(trim(v_sub.full_name), ''), 'Riverbanc Subscriber'),
        v_sub.email,
        60.00, 'ZMW', _billing_date, v_period_end,
        'payroll', v_sub.payroll_reference
      )
      RETURNING * INTO v_receipt;

      INSERT INTO public.receipt_deliveries (receipt_id, channel, status, delivered_at)
      VALUES
        (v_receipt.id, 'dashboard', 'available', now()),
        (v_receipt.id, 'email', 'pending', NULL);

      INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
      VALUES (
        v_sub.user_id, 'system', 'subscription_payment_receipted', v_receipt.id::text,
        'payment_receipts', NULL,
        jsonb_build_object('receipt_number', v_receipt.receipt_number, 'amount', 60.00, 'currency', 'ZMW', 'payment_method', 'payroll', 'payroll_reference', v_sub.payroll_reference, 'billing_period_start', _billing_date, 'billing_period_end', v_period_end)
      );

      v_receipts := v_receipts + 1;
    EXCEPTION WHEN unique_violation THEN
      -- A prior successful attempt already created the ledger entry/receipt.
      NULL;
    END;
  END LOOP;

  UPDATE public.billing_runs
  SET eligible_count = v_eligible,
      confirmed_count = (SELECT count(*) FROM public.billing_transactions WHERE billing_run_id = v_run.id AND status = 'confirmed'),
      transaction_count = (SELECT count(*) FROM public.billing_transactions WHERE billing_run_id = v_run.id),
      receipt_count = (SELECT count(*) FROM public.payment_receipts r JOIN public.billing_transactions t ON t.id = r.billing_transaction_id WHERE t.billing_run_id = v_run.id),
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = v_run.id
  RETURNING * INTO v_run;

  RETURN jsonb_build_object(
    'billing_run_id', v_run.id,
    'status', v_run.status,
    'eligible', v_run.eligible_count,
    'confirmed', v_run.confirmed_count,
    'transactions', v_run.transaction_count,
    'receipts', v_run.receipt_count,
    'created_now', v_created,
    'receipts_created_now', v_receipts,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION private.run_riverbanc_monthly_billing(date) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_my_payment_receipts()
RETURNS TABLE (
  id uuid,
  receipt_number text,
  amount numeric,
  currency text,
  billing_period_start date,
  billing_period_end date,
  payment_method text,
  payroll_reference text,
  issued_at timestamptz,
  document_path text,
  email_delivery_status text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT r.id, r.receipt_number, r.amount, r.currency,
         r.billing_period_start, r.billing_period_end, r.payment_method,
         r.payroll_reference, r.issued_at, r.document_path,
         d.status AS email_delivery_status
  FROM public.payment_receipts r
  LEFT JOIN public.receipt_deliveries d
    ON d.receipt_id = r.id AND d.channel = 'email'
  WHERE r.user_id = (select auth.uid())
  ORDER BY r.issued_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_payment_receipts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payment_receipts() TO authenticated;
