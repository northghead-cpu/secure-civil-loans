
-- Credit checks table
CREATE TABLE public.credit_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_by uuid NOT NULL,
  nrc_number text NOT NULL,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'CLEAR',
  score integer,
  score_rating text,
  risk_level text,
  recommendation text,
  open_accounts integer DEFAULT 0,
  probability_of_default numeric(5,2) DEFAULT 0,
  total_outstanding_zmw numeric(15,2) DEFAULT 0,
  adverse_count integer DEFAULT 0,
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all credit checks"
ON public.credit_checks FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'compliance_team'::app_role));

CREATE POLICY "Admins can insert credit checks"
ON public.credit_checks FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Payouts table
CREATE TABLE public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lender text NOT NULL,
  amount_zmw numeric(15,2) NOT NULL DEFAULT 0,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_date date,
  processed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all payouts"
ON public.payouts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert payouts"
ON public.payouts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update payouts"
ON public.payouts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime on audit_logs for live feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payouts;
