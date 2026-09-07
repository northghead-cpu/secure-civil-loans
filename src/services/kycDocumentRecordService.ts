export type KycDocumentType = "NRC" | "GOV_ID" | "PAYSLIP" | "INTRODUCTORY_LETTER";

export interface KycDocumentUpload {
  documentType: KycDocumentType;
  storagePath: string;
  payPeriod?: string;
  ocrPeriod?: string | null;
  ocrConfidence?: number | null;
}

export interface KycDocumentRecord {
  user_id: string;
  document_type: KycDocumentType;
  storage_path: string;
  pay_period?: string;
  ocr_period?: string | null;
  ocr_confidence?: number | null;
  validation_status: "PENDING";
}

export const buildKycDocumentRecords = ({
  userId,
  uploads,
}: {
  userId: string;
  uploads: KycDocumentUpload[];
}): KycDocumentRecord[] =>
  uploads.map(({ documentType, storagePath, payPeriod, ocrPeriod, ocrConfidence }) => ({
    user_id: userId,
    document_type: documentType,
    storage_path: storagePath,
    ...(payPeriod ? { pay_period: payPeriod } : {}),
    ...(ocrPeriod ? { ocr_period: ocrPeriod } : {}),
    ...(ocrConfidence != null ? { ocr_confidence: ocrConfidence } : {}),
    validation_status: "PENDING",
  }));
