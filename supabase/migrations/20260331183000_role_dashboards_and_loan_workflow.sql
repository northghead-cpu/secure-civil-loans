ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS years_of_service integer;

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS requested_amount numeric,
  ADD COLUMN IF NOT EXISTS selected_lender text,
  ADD COLUMN IF NOT EXISTS selected_interest_rate numeric,
  ADD COLUMN IF NOT EXISTS selected_repayment_months integer,
  ADD COLUMN IF NOT EXISTS estimated_monthly_repayment numeric,
  ADD COLUMN IF NOT EXISTS verification_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_notes text;

CREATE TABLE IF NOT EXISTS public.bank_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  interest_rate numeric NOT NULL,
  min_amount numeric NOT NULL DEFAULT 10000,
  max_amount numeric NOT NULL,
  max_term_months integer NOT NULL,
  processing_days integer NOT NULL DEFAULT 2,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bank products"
  ON public.bank_products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage bank products"
  ON public.bank_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.bank_products (bank_name, interest_rate, min_amount, max_amount, max_term_months, processing_days)
SELECT * FROM (
  VALUES
    ('Stanbic Bank Zambia', 17.5, 10000, 250000, 72, 1),
    ('Zanaco', 18.9, 10000, 180000, 60, 2),
    ('FNB Zambia', 19.8, 10000, 140000, 48, 3),
    ('Atlas Mara Bank', 21.2, 10000, 120000, 48, 3)
) AS seed(bank_name, interest_rate, min_amount, max_amount, max_term_months, processing_days)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_products existing WHERE existing.bank_name = seed.bank_name
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid NULL,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'super_user')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'compliance_team')
  );

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
