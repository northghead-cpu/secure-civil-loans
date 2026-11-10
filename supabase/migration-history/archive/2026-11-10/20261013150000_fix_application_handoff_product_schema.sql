-- Keep application handoff authorization aligned with bank_products schema.
-- bank_products stores the lender name in bank_name; it has no product_name column.
CREATE OR REPLACE FUNCTION private.authorize_application_handoff_internal(
  _user_id uuid,
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
DECLARE
  v_product public.bank_products;
  v_profile_full_name text;
  v_handoff public.application_handoffs;
  v_authorized_at timestamptz := clock_timestamp();
  v_authorization_text text;
  v_authorization_hash text;
BEGIN
  IF _user_id IS NULL OR _user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _requested_amount IS NULL OR _requested_amount <= 0 THEN RAISE EXCEPTION 'Invalid requested amount'; END IF;
  IF _term_months IS NULL OR _term_months <= 0 THEN RAISE EXCEPTION 'Invalid term'; END IF;

  SELECT * INTO v_product FROM public.bank_products WHERE id = _lender_product_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected loan product is unavailable'; END IF;
  IF _requested_amount < v_product.min_amount OR _requested_amount > v_product.max_amount THEN RAISE EXCEPTION 'Requested amount is outside the selected product limits'; END IF;
  IF _term_months > v_product.max_term_months THEN RAISE EXCEPTION 'Requested term is outside the selected product limits'; END IF;

  SELECT trim(full_name) INTO v_profile_full_name FROM public.profiles WHERE user_id = _user_id;
  IF v_profile_full_name IS NULL OR length(v_profile_full_name) < 2 THEN RAISE EXCEPTION 'Verified legal name is required'; END IF;
  IF lower(trim(coalesce(_signature_name, ''))) <> lower(v_profile_full_name) THEN RAISE EXCEPTION 'Authorization signature must match your verified legal name'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND consent_accepted = true) THEN RAISE EXCEPTION 'Required Riverbanc consent has not been accepted'; END IF;

  v_authorization_text := format(
    'INFORMATION-SHARING AUTHORIZATION (handoff-v1-2026-08)\n\nI authorize Riverbanc Technology Limited to prepare and share my verified information with %s for my selected loan application.\n\nSelected product: %s\nRequested amount: ZMW %s\nSelected term: %s months\nAnnual interest rate: %s%%',
    v_product.bank_name, v_product.bank_name, _requested_amount, _term_months, v_product.interest_rate
  );
  SELECT encode(extensions.digest(concat_ws('|', _user_id::text, _lender_product_id::text, _requested_amount::text, _term_months::text, v_authorized_at::text, v_authorization_text), 'sha256'), 'hex')
  INTO v_authorization_hash;

  INSERT INTO public.application_handoffs (
    user_id, lender_product_id, lender_name, product_name, requested_amount, term_months,
    interest_rate, estimated_monthly_repayment, total_repayment, information_categories,
    authorization_text, authorization_version, authorized_at, authorization_signature, status
  ) VALUES (
    _user_id, _lender_product_id, v_product.bank_name, v_product.bank_name, _requested_amount,
    _term_months, v_product.interest_rate, NULL, NULL,
    ARRAY['Identity information','Employment information','Income information','Verification results','Relevant supporting documents'],
    v_authorization_text, 'handoff-v1-2026-08', v_authorized_at, v_profile_full_name, 'authorized'
  ) RETURNING * INTO v_handoff;

  INSERT INTO private.application_handoff_secrets(handoff_id, authorization_hash) VALUES (v_handoff.id, v_authorization_hash);
  INSERT INTO public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value)
  VALUES (_user_id, 'borrower', 'application_handoff_authorized', v_handoff.id::text, 'application_handoffs', NULL,
    jsonb_build_object('lender_product_id', _lender_product_id, 'lender_name', v_product.bank_name, 'product_name', v_product.bank_name,
      'requested_amount', _requested_amount, 'term_months', _term_months, 'authorization_version', 'handoff-v1-2026-08'));
  RETURN v_handoff;
END;
$$;
