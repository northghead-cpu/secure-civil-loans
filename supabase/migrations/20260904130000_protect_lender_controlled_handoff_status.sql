-- Riverbanc may coordinate and record its own handoff stages, but it must not
-- manually create or overwrite lender-controlled decisions. Service-role
-- lender integrations remain able to persist lender-reported milestones.
CREATE OR REPLACE FUNCTION public.prevent_manual_lender_handoff_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND (
       OLD.status IN ('lender_review', 'additional_information_requested', 'approved', 'declined', 'disbursed')
       OR NEW.status IN ('lender_review', 'additional_information_requested', 'approved', 'declined', 'disbursed')
     ) THEN
    RAISE EXCEPTION 'Lender-controlled application handoff statuses must be reported by the financial institution';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lender_controlled_handoff_status ON public.application_handoffs;
CREATE TRIGGER trg_protect_lender_controlled_handoff_status
  BEFORE UPDATE ON public.application_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_manual_lender_handoff_status_change();
