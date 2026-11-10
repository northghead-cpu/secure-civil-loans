ALTER POLICY "Admins can do everything" ON public.risk_flags USING (((select auth.jwt() ->> 'role'::text) = 'admin'::text));
