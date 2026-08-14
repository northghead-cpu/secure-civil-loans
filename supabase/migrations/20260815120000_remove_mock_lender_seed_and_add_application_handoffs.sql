-- Remove legacy presentation/demo lender records that were seeded by an earlier migration.
-- Real lender products must be created through the lender-product administration workflow.
DELETE FROM public.bank_products
WHERE bank_name IN (
  'Stanbic Bank Zambia',
  'Zanaco',
  'FNB Zambia',
  'Atlas Mara Bank'
)
AND interest_rate IN (17.5, 18.9, 19.8, 21.2)
AND min_amount = 10000
AND max_amount IN (250000, 180000, 140000, 120000)
AND max_term_months IN (72, 60, 48)
AND processing_days IN (1, 2, 3);

CREATE TABLE IF NOT EXISTS public.application_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_application_id uuid REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  lender_product_id uuid REFERENCES public.bank_products(id) ON DELETE SET NULL,
  lender_name text NOT NULL,
  product_name text,
  requested_amount numeric,
  term_months integer,
  interest_rate numeric,
  estimated_monthly_repayment numeric,
  total_repayment numeric,
  information_categories text[] NOT NULL DEFAULT '{}',
  authorization_text text NOT NULL,
  authorization_version text NOT NULL,
  authorized_at timestamptz,
  authorization_signature text,
  status text NOT NULL DEFAULT 'pending_authorization'
    CHECK (status IN ('pending_authorization', 'authorized', 'preparing', 'sent_to_lender', 'lender_review', 'decision')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_handoffs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.application_handoffs TO authenticated;
GRANT ALL ON public.application_handoffs TO service_role;

CREATE POLICY "Users can view own application handoffs"
  ON public.application_handoffs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'compliance_team')
  );

CREATE POLICY "Users can create own application handoffs"
  ON public.application_handoffs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can authorize own application handoffs"
  ON public.application_handoffs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_application_handoffs_user
  ON public.application_handoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_application_handoffs_application
  ON public.application_handoffs(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_application_handoffs_status
  ON public.application_handoffs(status);

CREATE OR REPLACE FUNCTION public.set_application_handoff_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_handoff_updated_at ON public.application_handoffs;
CREATE TRIGGER trg_application_handoff_updated_at
  BEFORE UPDATE ON public.application_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_application_handoff_updated_at();
