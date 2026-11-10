
-- Underwriting queue table
CREATE TABLE public.underwriting_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  zmw_client_id uuid NOT NULL UNIQUE,
  income_zmw numeric(15,2) NOT NULL,
  debt_zmw numeric(15,2) NOT NULL,
  score_result integer,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.underwriting_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own underwriting records"
  ON public.underwriting_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own underwriting records"
  ON public.underwriting_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all underwriting records"
  ON public.underwriting_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update underwriting records"
  ON public.underwriting_queue FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Loan results table
CREATE TABLE public.loan_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zmw_client_id uuid NOT NULL REFERENCES public.underwriting_queue(zmw_client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  max_limit_zmw numeric(15,2),
  interest_rate numeric(5,2),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loan results"
  ON public.loan_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loan results"
  ON public.loan_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all loan results"
  ON public.loan_results FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage loan results"
  ON public.loan_results FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Triggers for updated_at
CREATE TRIGGER update_underwriting_queue_updated_at
  BEFORE UPDATE ON public.underwriting_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scoring function
CREATE OR REPLACE FUNCTION public.calculate_zmw_underwriting(p_income numeric, p_debt numeric)
RETURNS TABLE(calculated_score integer, max_limit numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_score integer := 400;
  dti numeric;
BEGIN
  dti := CASE WHEN p_income > 0 THEN p_debt / p_income ELSE 1 END;
  
  IF dti < 0.3 THEN
    base_score := base_score + 200;
  ELSIF dti > 0.5 THEN
    base_score := base_score - 100;
  END IF;
  
  calculated_score := base_score;
  max_limit := p_income * 0.4;
  RETURN NEXT;
END;
$$;
