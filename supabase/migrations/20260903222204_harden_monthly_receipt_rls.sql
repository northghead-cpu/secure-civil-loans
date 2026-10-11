DROP POLICY IF EXISTS "Users can view own billing transactions" ON public.billing_transactions;
DROP POLICY IF EXISTS "Admins can view all billing transactions" ON public.billing_transactions;
DROP POLICY IF EXISTS "Users can view own payment receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Admins can view all payment receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Users can view own receipt deliveries" ON public.receipt_deliveries;
DROP POLICY IF EXISTS "Admins can view all receipt deliveries" ON public.receipt_deliveries;

CREATE POLICY "Billing transactions owner or financial admin" ON public.billing_transactions
FOR SELECT TO authenticated
USING ((select auth.uid())=user_id OR private.has_role((select auth.uid()),'admin'::app_role) OR private.has_role((select auth.uid()),'super_admin'::app_role) OR private.has_role((select auth.uid()),'super_user'::app_role) OR private.has_role((select auth.uid()),'compliance_team'::app_role));

CREATE POLICY "Payment receipts owner or financial admin" ON public.payment_receipts
FOR SELECT TO authenticated
USING ((select auth.uid())=user_id OR private.has_role((select auth.uid()),'admin'::app_role) OR private.has_role((select auth.uid()),'super_admin'::app_role) OR private.has_role((select auth.uid()),'super_user'::app_role) OR private.has_role((select auth.uid()),'compliance_team'::app_role));

CREATE POLICY "Receipt deliveries owner or financial admin" ON public.receipt_deliveries
FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.payment_receipts r WHERE r.id=receipt_id AND (r.user_id=(select auth.uid()) OR private.has_role((select auth.uid()),'admin'::app_role) OR private.has_role((select auth.uid()),'super_admin'::app_role) OR private.has_role((select auth.uid()),'super_user'::app_role) OR private.has_role((select auth.uid()),'compliance_team'::app_role))));
