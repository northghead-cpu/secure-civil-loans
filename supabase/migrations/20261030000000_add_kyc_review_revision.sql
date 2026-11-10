-- Restore the KYC admin query's required review revision column.
-- Additive and safe for existing profile records; no customer data is deleted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_review_revision uuid NOT NULL DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION private.bump_kyc_review_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.kyc_review_revision := gen_random_uuid();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.bump_kyc_review_revision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_kyc_review_revision ON public.profiles;
CREATE TRIGGER zz_kyc_review_revision
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION private.bump_kyc_review_revision();
