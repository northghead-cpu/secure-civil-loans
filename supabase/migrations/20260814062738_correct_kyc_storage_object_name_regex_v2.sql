-- Correct the KYC storage object-name validator to require a literal file-extension dot.
-- Forward-only: historical migrations are intentionally preserved.
CREATE OR REPLACE FUNCTION public.is_valid_kyc_storage_object_name(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT object_name ~* '^(nrc|gov-id|payslip)-[0-9]{13}\.(pdf|png|jpe?g)$'
$$;
