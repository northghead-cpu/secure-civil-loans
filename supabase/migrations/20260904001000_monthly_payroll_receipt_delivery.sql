-- Private receipt storage. Files are never public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Users can read own payment receipt files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "Admins can read payment receipt files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    has_role((select auth.uid()), 'admin'::app_role) OR
    has_role((select auth.uid()), 'super_admin'::app_role) OR
    has_role((select auth.uid()), 'super_user'::app_role) OR
    has_role((select auth.uid()), 'compliance_team'::app_role)
  )
);

CREATE OR REPLACE FUNCTION public.process_riverbanc_monthly_billing(_billing_date date)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.run_riverbanc_monthly_billing(_billing_date);
$$;

REVOKE ALL ON FUNCTION public.process_riverbanc_monthly_billing(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_riverbanc_monthly_billing(date) TO service_role;
