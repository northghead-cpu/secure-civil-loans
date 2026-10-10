-- Keep incomplete applications for 12 months after their latest recorded update.
-- This avoids purging an application less than one year after it was last active.
CREATE OR REPLACE FUNCTION public.run_data_retention_purge()
RETURNS public.retention_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loans int := 0;
  v_notes int := 0;
  v_edge int := 0;
  v_row public.retention_runs;
BEGIN
  WITH del AS (
    DELETE FROM public.loan_applications
    WHERE COALESCE(updated_at, created_at) < now() - interval '12 months'
      AND status IN ('draft', 'abandoned', 'incomplete')
      AND decision IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_loans FROM del;

  WITH del AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '24 months'
    RETURNING 1
  )
  SELECT count(*) INTO v_notes FROM del;

  WITH del AS (
    DELETE FROM public.edge_request_log
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_edge FROM del;

  INSERT INTO public.retention_runs(
    loan_apps_deleted, notifications_deleted, edge_logs_deleted, notes
  )
  VALUES (v_loans, v_notes, v_edge, 'scheduled purge')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
