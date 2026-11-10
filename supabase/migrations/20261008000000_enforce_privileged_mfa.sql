-- 47-control remediation: privileged administrator sessions must be MFA-assured.
-- Normal user access remains unchanged; service_role remains unaffected because
-- Supabase service_role bypasses RLS by design.
CREATE OR REPLACE FUNCTION private.is_privileged_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN (
        'super_admin',
        'admin',
        'super_user',
        'compliance_team',
        'data_entry_team'
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_privileged_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_privileged_role(uuid) TO authenticated;

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'profiles',
    'user_roles',
    'loan_applications',
    'audit_logs',
    'bank_products',
    'kyc',
    'risk_flags',
    'products',
    'payroll_integrations',
    'underwriting_queue',
    'loan_results',
    'credit_checks',
    'payouts',
    'payroll_deduction_authorizations',
    'consent_history',
    'retention_runs',
    'report_sync_state',
    'subscription_authorizations',
    'application_handoffs',
    'incidents',
    'incident_actions',
    'incident_event_rules',
    'reconciliation_checks',
    'reconciliation_runs',
    'reconciliation_findings',
    'lender_commission_settings',
    'system_settings',
    'automation_rules',
    'billing_runs',
    'billing_transactions',
    'payment_receipts',
    'receipt_deliveries',
    'incident_ingestion_events',
    'kyc_documents'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Privileged sessions require MFA" ON public.%I',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY "Privileged sessions require MFA" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (
        NOT private.is_privileged_role(auth.uid())
        OR (auth.jwt() ->> ''aal'') = ''aal2''
      ) WITH CHECK (
        NOT private.is_privileged_role(auth.uid())
        OR (auth.jwt() ->> ''aal'') = ''aal2''
      )',
      table_name
    );
  END LOOP;
END $$;
