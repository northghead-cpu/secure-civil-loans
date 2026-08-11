-- Stage 2 security remediation: enforce the KYC storage naming contract at
-- the Storage authorization layer. Client-side naming is not trusted.

CREATE OR REPLACE FUNCTION public.is_valid_kyc_storage_object_name(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT object_name ~ '^(nrc|gov-id|payslip)-[0-9]{13}\.(pdf|png|jpe?g)$'
$$;

-- Tighten INSERT authorization so an authenticated user can only create a
-- KYC object inside their own UUID folder and with the exact expected name.
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 2
  AND public.is_valid_kyc_storage_object_name((storage.foldername(name))[2])
);

-- Keep updates inside the same invariant. This prevents an already-authorized
-- object from being renamed into an unexpected path/name.
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 2
  AND public.is_valid_kyc_storage_object_name((storage.foldername(name))[2])
);
