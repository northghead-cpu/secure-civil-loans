CREATE TABLE IF NOT EXISTS public.report_sync_state (
  id text PRIMARY KEY,
  spreadsheet_id text,
  last_synced_at timestamptz,
  last_synced_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.report_sync_state TO authenticated;
GRANT ALL ON public.report_sync_state TO service_role;

ALTER TABLE public.report_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view report sync state"
ON public.report_sync_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_report_sync_state_updated_at
BEFORE UPDATE ON public.report_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();