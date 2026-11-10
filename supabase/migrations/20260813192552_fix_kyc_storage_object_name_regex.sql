CREATE OR REPLACE FUNCTION public.is_valid_kyc_storage_object_name(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT object_name ~* ('^(nrc|gov-id|payslip)-[0-9]{13}' || chr(92) || '\\.(pdf|png|jpe?g)$')
$$;
