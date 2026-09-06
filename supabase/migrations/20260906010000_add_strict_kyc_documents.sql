-- First-class KYC document records. Verification state is controlled by trusted
-- review/system paths; applicants cannot self-mark documents verified.
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('NRC', 'GOV_ID', 'PAYSLIP', 'INTRODUCTORY_LETTER')),
  storage_path text NOT NULL,
  pay_period date,
  ocr_period text,
  ocr_confidence numeric(5,2),
  validation_status text NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'REJECTED', 'REVIEW')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kyc_documents_payslip_period_required CHECK (document_type <> 'PAYSLIP' OR pay_period IS NOT NULL),
  CONSTRAINT kyc_documents_path_owner CHECK (storage_path = user_id::text || '/' || split_part(storage_path, '/', 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS kyc_documents_unique_payslip_period
  ON public.kyc_documents (user_id, pay_period)
  WHERE document_type = 'PAYSLIP' AND validation_status <> 'REJECTED';

CREATE UNIQUE INDEX IF NOT EXISTS kyc_documents_unique_intro_letter
  ON public.kyc_documents (user_id)
  WHERE document_type = 'INTRODUCTORY_LETTER' AND validation_status <> 'REJECTED';

CREATE INDEX IF NOT EXISTS kyc_documents_user_status_idx
  ON public.kyc_documents (user_id, document_type, validation_status);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own KYC documents" ON public.kyc_documents;
CREATE POLICY "Users can view own KYC documents"
ON public.kyc_documents FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own pending KYC documents" ON public.kyc_documents;
CREATE POLICY "Users can create own pending KYC documents"
ON public.kyc_documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND validation_status = 'PENDING');

DROP POLICY IF EXISTS "Users cannot update KYC validation state" ON public.kyc_documents;
CREATE POLICY "Users cannot update KYC validation state"
ON public.kyc_documents FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND validation_status = 'PENDING')
WITH CHECK (auth.uid() = user_id AND validation_status = 'PENDING');

CREATE OR REPLACE FUNCTION public.is_valid_kyc_storage_object_name(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT object_name ~* '^(nrc|gov-id|payslip|introductory-letter)-[0-9]{13}\.(pdf|png|jpe?g)$'
$$;

-- Prevent applicant-side mutation of a validated/rejected document record.
REVOKE UPDATE (validation_status, rejection_reason, ocr_confidence, pay_period, ocr_period)
  ON public.kyc_documents FROM authenticated;

COMMENT ON TABLE public.kyc_documents IS 'Authoritative KYC document inventory. PAYSLIP rows represent OCR-established calendar periods; INTRODUCTORY_LETTER is upload-only government employment evidence.';
