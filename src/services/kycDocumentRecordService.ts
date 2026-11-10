import { parseOcrPayslipPeriod } from "./payslipPeriodValidationService";

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
  uploads.map(({ documentType, storagePath, payPeriod, ocrPeriod, ocrConfidence }) => {
    const detected = documentType === "PAYSLIP" && !payPeriod ? parseOcrPayslipPeriod(ocrPeriod) : null;
    const resolvedPayPeriod = payPeriod ?? (detected ? `${detected.key}-01` : undefined);

    if (documentType === "PAYSLIP" && !resolvedPayPeriod) {
      throw new Error("PAYSLIP document record requires a valid OCR pay period");
    }

    return {
      user_id: userId,
      document_type: documentType,
      storage_path: storagePath,
      ...(resolvedPayPeriod ? { pay_period: resolvedPayPeriod } : {}),
      ...(ocrPeriod ? { ocr_period: ocrPeriod } : {}),
      ...(ocrConfidence != null ? { ocr_confidence: ocrConfidence } : {}),
      validation_status: "PENDING",
    };
  });
