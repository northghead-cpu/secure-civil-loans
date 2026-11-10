import { describe, expect, it } from "vitest";
import { buildKycDocumentRecords } from "./kycDocumentRecordService";

describe("KYC document record mapping", () => {
  it("derives authoritative payslip periods from OCR and preserves document metadata", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const records = buildKycDocumentRecords({
      userId,
      uploads: [
        { documentType: "NRC", storagePath: `${userId}/nrc-1234567890123.pdf` },
        { documentType: "GOV_ID", storagePath: `${userId}/gov-id-1234567890124.pdf` },
        { documentType: "PAYSLIP", storagePath: `${userId}/payslip-1234567890125.pdf`, ocrPeriod: "June 2026", ocrConfidence: 94 },
        { documentType: "PAYSLIP", storagePath: `${userId}/payslip-1234567890126.pdf`, ocrPeriod: "July 2026", ocrConfidence: 96 },
        { documentType: "PAYSLIP", storagePath: `${userId}/payslip-1234567890127.pdf`, ocrPeriod: "August 2026", ocrConfidence: 92 },
        { documentType: "INTRODUCTORY_LETTER", storagePath: `${userId}/introductory-letter-1234567890128.pdf` },
      ],
    });

    expect(records).toEqual([
      { user_id: userId, document_type: "NRC", storage_path: `${userId}/nrc-1234567890123.pdf`, validation_status: "PENDING" },
      { user_id: userId, document_type: "GOV_ID", storage_path: `${userId}/gov-id-1234567890124.pdf`, validation_status: "PENDING" },
      { user_id: userId, document_type: "PAYSLIP", storage_path: `${userId}/payslip-1234567890125.pdf`, pay_period: "2026-06-01", ocr_period: "June 2026", ocr_confidence: 94, validation_status: "PENDING" },
      { user_id: userId, document_type: "PAYSLIP", storage_path: `${userId}/payslip-1234567890126.pdf`, pay_period: "2026-07-01", ocr_period: "July 2026", ocr_confidence: 96, validation_status: "PENDING" },
      { user_id: userId, document_type: "PAYSLIP", storage_path: `${userId}/payslip-1234567890127.pdf`, pay_period: "2026-08-01", ocr_period: "August 2026", ocr_confidence: 92, validation_status: "PENDING" },
      { user_id: userId, document_type: "INTRODUCTORY_LETTER", storage_path: `${userId}/introductory-letter-1234567890128.pdf`, validation_status: "PENDING" },
    ]);
  });

  it("rejects a payslip record when OCR cannot establish a calendar month", () => {
    expect(() => buildKycDocumentRecords({
      userId: "11111111-1111-1111-1111-111111111111",
      uploads: [{ documentType: "PAYSLIP", storagePath: "11111111-1111-1111-1111-111111111111/payslip-1234567890123.pdf", ocrPeriod: "unclear" }],
    })).toThrow("PAYSLIP document record requires a valid OCR pay period");
  });
});
