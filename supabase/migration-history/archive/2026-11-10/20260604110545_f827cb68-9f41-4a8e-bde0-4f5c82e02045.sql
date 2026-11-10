
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'data_entry_team')
  ) THEN
    NEW.kyc_status     := OLD.kyc_status;
    NEW.nrc_verified   := OLD.nrc_verified;
    NEW.phone_verified := OLD.phone_verified;
    NEW.account_status := OLD.account_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

CREATE OR REPLACE FUNCTION public.protect_profile_consent_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the profile owner, admin, or super_admin may modify consent fields.
  -- data_entry_team is explicitly NOT allowed.
  IF NOT (
    auth.uid() = NEW.user_id OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  ) THEN
    NEW.consent_accepted  := OLD.consent_accepted;
    NEW.consent_signed_at := OLD.consent_signed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_consent_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_consent_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_consent_fields();

-- Reattach existing audit triggers so they continue to fire
DROP TRIGGER IF EXISTS trg_audit_kyc_status_change ON public.profiles;
CREATE TRIGGER trg_audit_kyc_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_kyc_status_change();

DROP TRIGGER IF EXISTS trg_audit_consent_change ON public.profiles;
CREATE TRIGGER trg_audit_consent_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_consent_change();
