CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.authorize_riverbanc_subscription_internal(_user_id uuid, _signed_name text)
RETURNS public.subscription_authorizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result public.subscription_authorizations;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(trim(coalesce(_signed_name, ''))) < 2 THEN RAISE EXCEPTION 'A valid signature name is required'; END IF;

  UPDATE public.subscription_authorizations
  SET status = 'revoked', revoked_at = now(), updated_at = now()
  WHERE user_id = _user_id AND status = 'active';

  INSERT INTO public.subscription_authorizations (user_id, signed_name, amount, currency, frequency, deduction_method, status, payroll_status)
  VALUES (_user_id, trim(_signed_name), 60.00, 'ZMW', 'monthly', 'payroll', 'active', 'pending')
  RETURNING * INTO result;

  INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  VALUES (_user_id, 'borrower', 'subscription_authorized', result.id::text, 'subscription_authorizations', NULL,
    jsonb_build_object('amount', result.amount, 'currency', result.currency, 'frequency', result.frequency,
      'deduction_method', result.deduction_method, 'payroll_status', result.payroll_status, 'authorized_at', result.authorized_at));

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION private.authorize_riverbanc_subscription_internal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.authorize_riverbanc_subscription_internal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.authorize_riverbanc_subscription(_signed_name text)
RETURNS public.subscription_authorizations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN private.authorize_riverbanc_subscription_internal(auth.uid(), _signed_name);
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_riverbanc_subscription(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_riverbanc_subscription(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.authorize_riverbanc_subscription(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_riverbanc_subscription_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id AND NEW.consent_accepted = true AND (OLD.consent_accepted IS DISTINCT FROM true) THEN
    PERFORM private.authorize_riverbanc_subscription_internal(auth.uid(), NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_riverbanc_subscription_from_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_riverbanc_subscription_from_profile() FROM anon, authenticated;
