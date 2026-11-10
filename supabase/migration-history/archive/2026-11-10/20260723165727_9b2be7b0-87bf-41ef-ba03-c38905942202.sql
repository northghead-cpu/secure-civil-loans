
-- =========================================================================
-- Phase 3: Database hardening (strictly additive)
-- =========================================================================

-- --- Foreign keys (NOT VALID to avoid failing on legacy test rows) --------

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.loan_applications(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.kyc
  ADD CONSTRAINT kyc_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.credit_checks
  ADD CONSTRAINT credit_checks_checked_by_fkey
  FOREIGN KEY (checked_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_processed_by_fkey
  FOREIGN KEY (processed_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.risk_flags
  ADD CONSTRAINT risk_flags_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.risk_flags
  ADD CONSTRAINT risk_flags_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.loan_applications(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.underwriting_queue
  ADD CONSTRAINT underwriting_queue_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.loan_results
  ADD CONSTRAINT loan_results_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.edge_request_log
  ADD CONSTRAINT edge_request_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

-- --- CHECK constraints for enum-like text columns (NOT VALID) ------------

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_status_check
  CHECK (status IN ('pending','reviewing','approved','rejected','disbursed','cancelled','processing')) NOT VALID;

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_decision_check
  CHECK (decision IS NULL OR decision IN ('approved','rejected','needs_review','pending')) NOT VALID;

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_risk_level_check
  CHECK (risk_level IS NULL OR risk_level IN ('low','medium','high','critical')) NOT VALID;

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_crb_status_check
  CHECK (crb_status IS NULL OR crb_status IN ('clear','flagged','adverse','pending')) NOT VALID;

ALTER TABLE public.kyc
  ADD CONSTRAINT kyc_status_check
  CHECK (status IS NULL OR status IN ('pending','submitted','verified','rejected','expired')) NOT VALID;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('pending','processing','sent','paid','disbursed','failed','cancelled')) NOT VALID;

ALTER TABLE public.credit_checks
  ADD CONSTRAINT credit_checks_status_check
  CHECK (status IN ('clear','adverse','flagged','pending','error')) NOT VALID;

ALTER TABLE public.underwriting_queue
  ADD CONSTRAINT underwriting_queue_status_check
  CHECK (status IS NULL OR status IN ('pending','scoring','scored','approved','rejected','error')) NOT VALID;

-- --- CHECK constraints for non-negative money / sane numeric bounds ------

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_amounts_nonneg
  CHECK (
    (gross_salary IS NULL OR gross_salary >= 0) AND
    (deductions IS NULL OR deductions >= 0) AND
    (net_salary IS NULL OR net_salary >= 0) AND
    (requested_amount IS NULL OR requested_amount >= 0) AND
    (estimated_monthly_repayment IS NULL OR estimated_monthly_repayment >= 0) AND
    (selected_interest_rate IS NULL OR selected_interest_rate >= 0) AND
    (interest_rate IS NULL OR interest_rate >= 0) AND
    (selected_repayment_months IS NULL OR selected_repayment_months > 0)
  ) NOT VALID;

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_scores_range
  CHECK (
    (fraud_score IS NULL OR (fraud_score >= 0 AND fraud_score <= 100)) AND
    (underwriting_score IS NULL OR (underwriting_score >= 0 AND underwriting_score <= 1000)) AND
    (credit_score IS NULL OR (credit_score >= 0 AND credit_score <= 1000))
  ) NOT VALID;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_amount_positive
  CHECK (amount_zmw > 0) NOT VALID;

ALTER TABLE public.credit_checks
  ADD CONSTRAINT credit_checks_score_range
  CHECK (
    (score IS NULL OR (score >= 0 AND score <= 1000)) AND
    (probability_of_default IS NULL OR (probability_of_default >= 0 AND probability_of_default <= 1)) AND
    (open_accounts IS NULL OR open_accounts >= 0) AND
    (adverse_count IS NULL OR adverse_count >= 0) AND
    (total_outstanding_zmw IS NULL OR total_outstanding_zmw >= 0)
  ) NOT VALID;

ALTER TABLE public.underwriting_queue
  ADD CONSTRAINT underwriting_queue_amounts_nonneg
  CHECK (
    (income_zmw IS NULL OR income_zmw >= 0) AND
    (debt_zmw IS NULL OR debt_zmw >= 0) AND
    (score_result IS NULL OR score_result >= 0)
  ) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_amounts_nonneg
  CHECK (
    (salary IS NULL OR salary >= 0) AND
    (net_salary IS NULL OR net_salary >= 0) AND
    (existing_obligations IS NULL OR existing_obligations >= 0) AND
    (years_of_service IS NULL OR years_of_service >= 0)
  ) NOT VALID;

ALTER TABLE public.risk_flags
  ADD CONSTRAINT risk_flags_fraud_score_range
  CHECK (fraud_score IS NULL OR (fraud_score >= 0 AND fraud_score <= 100)) NOT VALID;

-- --- Uniqueness: one KYC row per user, one queue row per client ----------

CREATE UNIQUE INDEX IF NOT EXISTS kyc_user_id_unique
  ON public.kyc(user_id) WHERE user_id IS NOT NULL;

-- underwriting_queue.zmw_client_id already unique via existing constraint.

-- --- Supporting indexes on FK/RLS columns --------------------------------

CREATE INDEX IF NOT EXISTS idx_loan_applications_user_id     ON public.loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status      ON public.loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_applications_created_at  ON public.loan_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id         ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_application_id  ON public.notifications(application_id);
CREATE INDEX IF NOT EXISTS idx_kyc_user_id                   ON public.kyc(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id            ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at         ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record       ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_credit_checks_checked_by      ON public.credit_checks(checked_by);
CREATE INDEX IF NOT EXISTS idx_credit_checks_nrc             ON public.credit_checks(nrc_number);
CREATE INDEX IF NOT EXISTS idx_payouts_processed_by          ON public.payouts(processed_by);
CREATE INDEX IF NOT EXISTS idx_payouts_status                ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_user_id            ON public.risk_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_application_id     ON public.risk_flags(application_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_status             ON public.risk_flags(status);
CREATE INDEX IF NOT EXISTS idx_underwriting_queue_user_id    ON public.underwriting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_results_user_id          ON public.loan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id            ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status           ON public.profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_pda_user_id                   ON public.payroll_deduction_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_pda_loan_application_id       ON public.payroll_deduction_authorizations(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_edge_request_log_user_nonce   ON public.edge_request_log(user_id, nonce);
CREATE INDEX IF NOT EXISTS idx_edge_request_log_created_at   ON public.edge_request_log(created_at DESC);

-- --- updated_at auto-touch triggers where missing ------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kyc','risk_flags','underwriting_queue','payroll_integrations','profiles','loan_applications','payouts']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='updated_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = format('trg_%s_updated_at', t)
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        t
      );
    END IF;
  END LOOP;
END $$;
