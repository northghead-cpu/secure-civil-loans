-- 1. Trigger function: audit KYC status changes on profiles
CREATE OR REPLACE FUNCTION public.audit_kyc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.kyc_status IS DISTINCT FROM NEW.kyc_status THEN
    INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
    VALUES (
      COALESCE(auth.uid(), NEW.user_id),
      COALESCE(
        (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
        'system'
      ),
      'kyc_status_changed',
      NEW.user_id::text,
      'profiles',
      jsonb_build_object('kyc_status', OLD.kyc_status::text),
      jsonb_build_object('kyc_status', NEW.kyc_status::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_kyc_status_change() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.audit_kyc_status_change() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_kyc_status ON public.profiles;
CREATE TRIGGER trg_audit_kyc_status
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_kyc_status_change();


-- 2. Trigger function: audit consent e-sign changes on profiles
CREATE OR REPLACE FUNCTION public.audit_consent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.consent_accepted IS DISTINCT FROM NEW.consent_accepted
     OR OLD.consent_signed_at IS DISTINCT FROM NEW.consent_signed_at THEN
    INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
    VALUES (
      COALESCE(auth.uid(), NEW.user_id),
      COALESCE(
        (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
        'system'
      ),
      'consent_esign_changed',
      NEW.user_id::text,
      'profiles',
      jsonb_build_object('consent_accepted', OLD.consent_accepted, 'consent_signed_at', OLD.consent_signed_at),
      jsonb_build_object('consent_accepted', NEW.consent_accepted, 'consent_signed_at', NEW.consent_signed_at)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_consent_change() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.audit_consent_change() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_consent ON public.profiles;
CREATE TRIGGER trg_audit_consent
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_consent_change();


-- 3. Trigger function: audit KYC table updates (employer, NRC, etc.)
CREATE OR REPLACE FUNCTION public.audit_kyc_table_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  VALUES (
    COALESCE(auth.uid(), NEW.user_id),
    COALESCE(
      (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
      'system'
    ),
    CASE WHEN TG_OP = 'INSERT' THEN 'kyc_record_created' ELSE 'kyc_record_updated' END,
    NEW.id::text,
    'kyc',
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_kyc_table_change() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.audit_kyc_table_change() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_kyc_table ON public.kyc;
CREATE TRIGGER trg_audit_kyc_table
  AFTER INSERT OR UPDATE ON public.kyc
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_kyc_table_change();