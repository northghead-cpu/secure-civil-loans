
-- Restrict calculate_zmw_underwriting to authenticated only
REVOKE EXECUTE ON FUNCTION public.calculate_zmw_underwriting(numeric, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_zmw_underwriting(numeric, numeric) FROM public;

-- Enable RLS on bank_products
ALTER TABLE public.bank_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bank products" ON public.bank_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage bank products" ON public.bank_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Enable RLS on kyc
ALTER TABLE public.kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own kyc" ON public.kyc FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kyc" ON public.kyc FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own kyc" ON public.kyc FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all kyc" ON public.kyc FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all notifications" ON public.notifications FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
