CREATE OR REPLACE FUNCTION public.sync_riverbanc_subscription_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id AND NEW.consent_accepted = true AND (OLD.consent_accepted IS DISTINCT FROM true) THEN
    PERFORM public.authorize_riverbanc_subscription(NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_riverbanc_subscription_from_profile() FROM PUBLIC;
CREATE TRIGGER profile_consent_creates_subscription_authorization
AFTER UPDATE OF consent_accepted ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_riverbanc_subscription_from_profile();
