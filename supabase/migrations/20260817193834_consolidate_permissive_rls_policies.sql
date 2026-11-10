-- bank_products: preserve public SELECT, admin INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Admins can manage bank products" ON public.bank_products;
DROP POLICY IF EXISTS bank_admin_only_insert ON public.bank_products;
DROP POLICY IF EXISTS bank_admin_only_select ON public.bank_products;
CREATE POLICY bank_admin_insert ON public.bank_products FOR INSERT TO authenticated WITH CHECK ((select private.has_role('admin'::text)) OR (select private.has_role('super_admin'::text)));
CREATE POLICY bank_admin_update ON public.bank_products FOR UPDATE TO authenticated USING ((select private.has_role('admin'::text)) OR (select private.has_role('super_admin'::text))) WITH CHECK ((select private.has_role('admin'::text)) OR (select private.has_role('super_admin'::text)));
CREATE POLICY bank_admin_delete ON public.bank_products FOR DELETE TO authenticated USING ((select private.has_role('admin'::text)) OR (select private.has_role('super_admin'::text)));

-- consent_history: merge admin/user SELECT paths
DROP POLICY IF EXISTS "Admins view all consent history" ON public.consent_history;
DROP POLICY IF EXISTS "Users view own consent history" ON public.consent_history;
CREATE POLICY consent_history_select ON public.consent_history FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)) OR (select private.has_role((select auth.uid()), 'compliance_team'::app_role)));

-- kyc: merge admin/user SELECT paths
DROP POLICY IF EXISTS "Admins can view all kyc" ON public.kyc;
DROP POLICY IF EXISTS "Users can view own kyc" ON public.kyc;
CREATE POLICY kyc_select ON public.kyc FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

-- loan_applications: preserve admin/compliance/super_user UPDATE authority as one policy
DROP POLICY IF EXISTS "Admins can update applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Super users can update applications" ON public.loan_applications;
DROP POLICY IF EXISTS loan_update_admin ON public.loan_applications;
CREATE POLICY loan_applications_update ON public.loan_applications FOR UPDATE TO authenticated USING ((select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)) OR (select private.has_role((select auth.uid()), 'compliance_team'::app_role)) OR (select private.has_role((select auth.uid()), 'super_user'::app_role))) WITH CHECK ((select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)) OR (select private.has_role((select auth.uid()), 'compliance_team'::app_role)) OR (select private.has_role((select auth.uid()), 'super_user'::app_role)));

-- loan_results: split admin ALL into update/delete, merge SELECT and INSERT
DROP POLICY IF EXISTS "Admins can manage loan results" ON public.loan_results;
DROP POLICY IF EXISTS "Admins can view all loan results" ON public.loan_results;
DROP POLICY IF EXISTS "Users can view own loan results" ON public.loan_results;
DROP POLICY IF EXISTS "Users can insert own loan results" ON public.loan_results;
CREATE POLICY loan_results_admin_update ON public.loan_results FOR UPDATE TO authenticated USING ((select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role))) WITH CHECK ((select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));
CREATE POLICY loan_results_admin_delete ON public.loan_results FOR DELETE TO authenticated USING ((select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));
CREATE POLICY loan_results_select ON public.loan_results FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));
CREATE POLICY loan_results_insert ON public.loan_results FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

-- notifications: merge INSERT and SELECT paths
DROP POLICY IF EXISTS "Authenticated can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_system ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id) OR (select private.has_role('admin'::text)) OR (select private.has_role('super_admin'::text)));
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

-- subscription_authorizations: merge SELECT paths
DROP POLICY IF EXISTS "Admins can view subscription authorizations" ON public.subscription_authorizations;
DROP POLICY IF EXISTS "Users can view own subscription authorization" ON public.subscription_authorizations;
CREATE POLICY subscription_authorizations_select ON public.subscription_authorizations FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_user'::app_role)) OR (select private.has_role((select auth.uid()), 'compliance_team'::app_role)));

-- underwriting_queue: merge SELECT paths
DROP POLICY IF EXISTS "Admins can view all underwriting records" ON public.underwriting_queue;
DROP POLICY IF EXISTS "Users can view own underwriting records" ON public.underwriting_queue;
CREATE POLICY underwriting_select ON public.underwriting_queue FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.has_role((select auth.uid()), 'admin'::app_role)) OR (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

-- user_roles: remove duplicate UPDATE policy, preserving the existing Admins can update roles rule
DROP POLICY IF EXISTS roles_admin_write ON public.user_roles;
