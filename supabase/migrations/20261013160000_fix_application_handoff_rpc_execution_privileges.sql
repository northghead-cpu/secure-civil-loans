-- The public RPC is the authenticated entry point. Run the internal transaction
-- with the function owner's privileges while deriving the actor exclusively from auth.uid().
-- The internal function independently verifies the caller matches the supplied user ID.
CREATE OR REPLACE FUNCTION public.authorize_application_handoff(
  _lender_product_id uuid,
  _requested_amount numeric,
  _term_months integer,
  _signature_name text
)
RETURNS public.application_handoffs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.authorize_application_handoff_internal(
    auth.uid(),
    _lender_product_id,
    _requested_amount,
    _term_months,
    _signature_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_application_handoff(uuid,numeric,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_application_handoff(uuid,numeric,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION private.authorize_application_handoff_internal(uuid,uuid,numeric,integer,text) FROM PUBLIC, anon, authenticated;
