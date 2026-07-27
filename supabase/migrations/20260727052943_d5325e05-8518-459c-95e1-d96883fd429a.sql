
-- === Granular consent columns ===
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_data_sharing_lenders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_crb_check boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consents_updated_at timestamptz;

-- === Consent history table ===
CREATE TABLE IF NOT EXISTS public.consent_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN (
    'marketing','data_sharing_lenders','crb_check','analytics','payroll_deduction','terms_privacy'
  )),
  previous_value boolean,
  new_value boolean NOT NULL,
  source text NOT NULL DEFAULT 'user_profile',
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consent_history TO authenticated;
GRANT ALL ON public.consent_history TO service_role;

ALTER TABLE public.consent_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consent history"
  ON public.consent_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all consent history"
  ON public.consent_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'compliance_team'::app_role));

CREATE POLICY "Users insert own consent history"
  ON public.consent_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND changed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_consent_history_user ON public.consent_history(user_id, created_at DESC);

-- === Trigger: log granular consent changes ===
CREATE OR REPLACE FUNCTION public.audit_granular_consent_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.consent_marketing IS DISTINCT FROM NEW.consent_marketing THEN
    INSERT INTO public.consent_history(user_id, consent_type, previous_value, new_value, changed_by)
    VALUES (NEW.user_id, 'marketing', OLD.consent_marketing, NEW.consent_marketing, auth.uid());
  END IF;
  IF OLD.consent_data_sharing_lenders IS DISTINCT FROM NEW.consent_data_sharing_lenders THEN
    INSERT INTO public.consent_history(user_id, consent_type, previous_value, new_value, changed_by)
    VALUES (NEW.user_id, 'data_sharing_lenders', OLD.consent_data_sharing_lenders, NEW.consent_data_sharing_lenders, auth.uid());
  END IF;
  IF OLD.consent_crb_check IS DISTINCT FROM NEW.consent_crb_check THEN
    INSERT INTO public.consent_history(user_id, consent_type, previous_value, new_value, changed_by)
    VALUES (NEW.user_id, 'crb_check', OLD.consent_crb_check, NEW.consent_crb_check, auth.uid());
  END IF;
  IF OLD.consent_analytics IS DISTINCT FROM NEW.consent_analytics THEN
    INSERT INTO public.consent_history(user_id, consent_type, previous_value, new_value, changed_by)
    VALUES (NEW.user_id, 'analytics', OLD.consent_analytics, NEW.consent_analytics, auth.uid());
  END IF;
  IF (OLD.consent_marketing        IS DISTINCT FROM NEW.consent_marketing)
  OR (OLD.consent_data_sharing_lenders IS DISTINCT FROM NEW.consent_data_sharing_lenders)
  OR (OLD.consent_crb_check        IS DISTINCT FROM NEW.consent_crb_check)
  OR (OLD.consent_analytics        IS DISTINCT FROM NEW.consent_analytics) THEN
    NEW.consents_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_granular_consent ON public.profiles;
CREATE TRIGGER trg_audit_granular_consent
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_granular_consent_change();

-- === Retention runs table ===
CREATE TABLE IF NOT EXISTS public.retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  loan_apps_deleted integer NOT NULL DEFAULT 0,
  notifications_deleted integer NOT NULL DEFAULT 0,
  edge_logs_deleted integer NOT NULL DEFAULT 0,
  consent_history_archived integer NOT NULL DEFAULT 0,
  notes text
);

GRANT SELECT ON public.retention_runs TO authenticated;
GRANT ALL ON public.retention_runs TO service_role;
ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view retention runs"
  ON public.retention_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'compliance_team'::app_role));

-- === Purge function ===
CREATE OR REPLACE FUNCTION public.run_data_retention_purge()
RETURNS public.retention_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loans int := 0;
  v_notes int := 0;
  v_edge  int := 0;
  v_row public.retention_runs;
BEGIN
  -- Abandoned/draft loan applications >12 months (never disbursed, no decision)
  WITH del AS (
    DELETE FROM public.loan_applications
    WHERE created_at < now() - interval '12 months'
      AND status IN ('draft','abandoned','incomplete')
      AND decision IS NULL
    RETURNING 1
  ) SELECT count(*) INTO v_loans FROM del;

  -- Notifications >24 months
  WITH del AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '24 months'
    RETURNING 1
  ) SELECT count(*) INTO v_notes FROM del;

  -- Edge request log >90 days
  WITH del AS (
    DELETE FROM public.edge_request_log
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO v_edge FROM del;

  INSERT INTO public.retention_runs(loan_apps_deleted, notifications_deleted, edge_logs_deleted, notes)
  VALUES (v_loans, v_notes, v_edge, 'scheduled purge')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.run_data_retention_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_retention_purge() TO service_role;

-- === Schedule daily at 02:00 UTC ===
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('riverbanc-data-retention-purge')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='riverbanc-data-retention-purge');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'riverbanc-data-retention-purge',
  '0 2 * * *',
  $$ SELECT public.run_data_retention_purge(); $$
);
