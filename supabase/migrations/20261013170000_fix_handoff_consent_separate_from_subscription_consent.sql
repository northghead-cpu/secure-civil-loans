-- Keep lender handoff consent separate from Riverbanc subscription consent.
-- Require explicit acceptance as an argument to the authenticated handoff RPC.
CREATE OR REPLACE FUNCTION public.authorize_application_handoff(
  _lender_product_id uuid,
  _requested_amount numeric,
  _term_months integer,
  _signature_name text,
  _authorization_accepted boolean
)
RETURNS public.application_handoffs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.authorize_application_handoff_internal(
    auth.uid(), _lender_product_id, _requested_amount, _term_months,
    _signature_name, _authorization_accepted
  );
END;
$$;
REVOKE ALL ON FUNCTION public.authorize_application_handoff(uuid,numeric,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authorize_application_handoff(uuid,numeric,integer,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_application_handoff(uuid,numeric,integer,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION private.authorize_application_handoff_internal(uuid,uuid,numeric,integer,text,boolean) FROM PUBLIC, anon, authenticated;
