/**
 * ID Document Parsing Service
 *
 * Extracts full name, document number, date of birth, and expiry date
 * from NRC and government ID documents using the existing OCR pipeline.
 *
 * Supports Zambian NRC, passports, driving licences, and government employee IDs.
 */

import { processDocument, type OCRResult } from "@/services/ocrService";
import { features } from "@/config/features";

export interface IDParseResult {
  /** Full name extracted from the document */
  full_name: string | null;
  /** Document / ID number */
  document_number: string | null;
  /** Date of birth */
  date_of_birth: string | null;
  /** Document expiry date */
  expiry_date: string | null;
  /** Gender if found */
  gender: string | null;
  /** Nationality if found */
  nationality: string | null;
  /** Raw OCR text */
  raw_text: string;
  /** OCR confidence 0-100 */
  confidence: number;
  /** Whether parsing succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

const log = (msg: string, data?: unknown) => {
  if (features.enableOCROLogging) {
    console.log(`[ID Parser] ${msg}`, data ?? "");
  }
};

/* ------------------------------------------------------------------ */
/*  Extraction helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Extract NRC number (Zambian format: 123456/78/1)
 */
const extractNrcNumber = (text: string): string | null => {
  const m = text.match(/\b(\d{6}\s*\/\s*\d{2}\s*\/\s*\d{1,2})\b/);
  return m ? m[1].replace(/\s/g, "") : null;
};

/**
 * Extract passport number (1-2 letters followed by 6-9 digits)
 */
const extractPassportNumber = (text: string): string | null => {
  const patterns = [
    /(?:passport\s*(?:no|number|#)?)[:\s]*([A-Z]{1,2}\d{6,9})/i,
    /\b([A-Z]{1,2}\d{6,9})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
};

/**
 * Extract driving licence number
 */
const extractDrivingLicenceNumber = (text: string): string | null => {
  const patterns = [
    /(?:licen[cs]e\s*(?:no|number|#)?)[:\s]+([A-Z0-9/-]{4,15})/i,
    /(?:dl\s*(?:no|number|#)?)[:\s]+([A-Z0-9/-]{4,15})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
};

/**
 * Extract employee ID number
 */
const extractEmployeeIdNumber = (text: string): string | null => {
  const patterns = [
    /(?:employee\s*(?:no|number|#|id)|emp\s*(?:no|#|id)|staff\s*(?:no|number|#|id))[:\s]*([A-Z0-9/-]{3,15})/i,
    /(?:id\s*(?:no|number|#))[:\s]*([A-Z0-9/-]{3,15})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
};

/**
 * Extract a general government ID number when type is unknown
 */
const extractGeneralIdNumber = (text: string): string | null => {
  const patterns = [
    /(?:id\s*(?:no|number|#)?|document\s*(?:no|number|#)?|card\s*(?:no|number|#)?)[:\s]*([A-Z0-9/-]{4,15})/i,
    /\b([A-Z]{1,3}\d{5,12})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
};

/**
 * Extract full name from document text.
 * Looks for labelled name fields first, then falls back to capitalized name heuristics.
 */
const extractFullName = (text: string): string | null => {
  // Labelled patterns
  const labelled = [
    /(?:full\s*name|surname.*given|name\s*of\s*holder|holder|bearer)[:\s]+([A-Z][A-Za-z\s.'-]{3,50})/i,
    /(?:names?|nom)[:\s]+([A-Z][A-Za-z\s.'-]{3,50})/i,
  ];
  for (const p of labelled) {
    const m = text.match(p);
    if (m) {
      const val = m[1].trim().replace(/\s{2,}/g, " ");
      // Reject if it looks like a header
      if (val.length > 3 && !/REPUBLIC|ZAMBIA|PASSPORT|LICEN/i.test(val)) return val;
    }
  }

  // Heuristic: lines of ALLCAPS words (2+ words, 4-50 chars) that are likely a name
  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[A-Z][A-Z\s.'-]{3,50}$/.test(trimmed)) {
      const words = trimmed.split(/\s+/);
      if (words.length >= 2 && words.length <= 5 && !/REPUBLIC|ZAMBIA|PASSPORT|LICEN|MINISTRY|NATIONAL|GOVERNMENT/i.test(trimmed)) {
        return trimmed;
      }
    }
  }

  return null;
};

/**
 * Parse a date string from various formats into a normalised string.
 */
const parseDateString = (raw: string): string => {
  return raw.trim();
};

/**
 * Extract dates near specific keywords.
 */
const extractDateNear = (text: string, keywords: string[]): string | null => {
  for (const kw of keywords) {
    const re = new RegExp(
      `${kw}[:\\s]*([\\d]{1,2}[\\s/\\-][\\d]{1,2}[\\s/\\-][\\d]{2,4}|\\d{4}[\\s/\\-]\\d{1,2}[\\s/\\-]\\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},?\\s+\\d{4})`,
      "i"
    );
    const m = text.match(re);
    if (m) return parseDateString(m[1]);
  }
  return null;
};

/**
 * Extract date of birth
 */
const extractDateOfBirth = (text: string): string | null => {
  return extractDateNear(text, [
    "date\\s*of\\s*birth",
    "d\\.?o\\.?b\\.?",
    "born",
    "birth\\s*date",
  ]);
};

/**
 * Extract expiry / validity date
 */
const extractExpiryDate = (text: string): string | null => {
  return extractDateNear(text, [
    "expir[yie]",
    "date\\s*of\\s*expir",
    "valid\\s*(?:until|to|thru|through)",
    "validity",
    "exp\\.?\\s*date",
  ]);
};

/**
 * Extract gender
 */
const extractGender = (text: string): string | null => {
  const m = text.match(/(?:sex|gender)[:\s]*(male|female|m|f)\b/i);
  if (m) {
    const v = m[1].toUpperCase();
    return v === "M" || v === "MALE" ? "Male" : v === "F" || v === "FEMALE" ? "Female" : v;
  }
  return null;
};

/**
 * Extract nationality
 */
const extractNationality = (text: string): string | null => {
  const m = text.match(/(?:nationality|citizenship)[:\s]*([A-Za-z]+)/i);
  if (m) return m[1].trim();
  if (/REPUBLIC\s+OF\s+ZAMBIA/i.test(text)) return "Zambian";
  return null;
};

/* ------------------------------------------------------------------ */
/*  Main parse functions                                               */
/* ------------------------------------------------------------------ */

export type IDDocumentType = "nrc" | "passport" | "driving_license" | "employee_id";

/**
 * Parse an NRC document and extract structured data.
 */
export const parseNRC = async (file: File): Promise<IDParseResult> => {
  return parseIDDocument(file, "nrc");
};

/**
 * Parse a government ID (passport, driving licence, employee ID).
 */
export const parseGovernmentID = async (
  file: File,
  idType: IDDocumentType = "passport"
): Promise<IDParseResult> => {
  return parseIDDocument(file, idType);
};

/**
 * Core parser that handles all ID document types.
 */
const parseIDDocument = async (
  file: File,
  idType: IDDocumentType
): Promise<IDParseResult> => {
  if (!features.enableOCR) {
    return {
      full_name: null,
      document_number: null,
      date_of_birth: null,
      expiry_date: null,
      gender: null,
      nationality: null,
      raw_text: "",
      confidence: 0,
      success: false,
      error: "OCR is disabled",
    };
  }

  try {
    log("Starting ID document parsing", { fileName: file.name, idType });

    const ocrType = idType === "nrc" ? "nrc" : "government_id";
    const ocr: OCRResult = await processDocument(file, ocrType);

    if (!ocr.success || !ocr.extracted_text) {
      return {
        full_name: ocr.full_name ?? null,
        document_number: ocr.document_number ?? null,
        date_of_birth: null,
        expiry_date: null,
        gender: null,
        nationality: null,
        raw_text: ocr.extracted_text ?? "",
        confidence: ocr.confidence,
        success: false,
        error: ocr.error ?? "OCR extraction failed",
      };
    }

    const text = ocr.extracted_text;

    // Extract document number based on type
    let document_number: string | null = null;
    switch (idType) {
      case "nrc":
        document_number = extractNrcNumber(text);
        break;
      case "passport":
        document_number = extractPassportNumber(text);
        break;
      case "driving_license":
        document_number = extractDrivingLicenceNumber(text) ?? extractGeneralIdNumber(text);
        break;
      case "employee_id":
        document_number = extractEmployeeIdNumber(text) ?? extractGeneralIdNumber(text);
        break;
      default:
        document_number = extractGeneralIdNumber(text);
    }

    // Fall back to OCR-level document_number
    if (!document_number) document_number = ocr.document_number ?? null;

    const full_name = extractFullName(text) ?? ocr.full_name ?? null;
    const date_of_birth = extractDateOfBirth(text) ?? ocr.date_of_birth ?? null;
    const expiry_date = extractExpiryDate(text);
    const gender = extractGender(text);
    const nationality = extractNationality(text);

    const result: IDParseResult = {
      full_name,
      document_number,
      date_of_birth,
      expiry_date,
      gender,
      nationality,
      raw_text: text,
      confidence: ocr.confidence,
      success: true,
    };

    log("ID document parsing complete", {
      full_name,
      document_number,
      date_of_birth,
      expiry_date,
      confidence: ocr.confidence,
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log("ID document parsing error", { error: msg });
    return {
      full_name: null,
      document_number: null,
      date_of_birth: null,
      expiry_date: null,
      gender: null,
      nationality: null,
      raw_text: "",
      confidence: 0,
      success: false,
      error: msg,
    };
  }
};

export default { parseNRC, parseGovernmentID };
