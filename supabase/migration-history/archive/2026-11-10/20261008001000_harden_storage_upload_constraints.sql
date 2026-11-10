-- 47-control remediation: enforce KYC/payment document upload constraints at Storage.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg'
    ]::text[]
WHERE id IN ('kyc-documents','payslips','payment-receipts');