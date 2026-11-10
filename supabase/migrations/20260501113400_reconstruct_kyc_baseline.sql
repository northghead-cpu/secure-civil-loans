-- Restore the missing KYC table baseline that exists in production but was never
-- captured in the repository migration chain.
--
-- This migration is intentionally placed immediately before the first existing
-- migration that references public.kyc. It is idempotent so applying it to the
-- existing production database does not recreate or alter the live table.

CREATE TABLE IF NOT EXISTS public.kyc (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  nrc_number text,
  employer text,
  employee_number text,
  phone_number text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Production has an existing trigger that transitions a newly-created pending
-- KYC record to submitted. Reconstruct it here so a clean migration replay
-- preserves the production behavior without depending on out-of-band state.
CREATE OR REPLACE FUNCTION public.set_kyc_submitted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.status := 'submitted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_auto_status ON public.kyc;
CREATE TRIGGER kyc_auto_status
BEFORE INSERT ON public.kyc
FOR EACH ROW
EXECUTE FUNCTION public.set_kyc_submitted();
