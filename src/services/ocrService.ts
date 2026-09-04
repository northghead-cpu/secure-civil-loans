/**
 * OCR Document Processing Service
 *
 * Extracts structured data from uploaded documents (NRC, payslips, bank statements)
 * using Tesseract.js for client-side OCR processing.
 *
 * This service is designed to be non-blocking and fail-safe - it will never
 * throw errors or crash the application if OCR processing fails.
 */

import Tesseract from "tesseract.js";
import { features } from "@/config/features";

export type DocumentType = "nrc" | "payslip" | "bank_statement" | "government_id";

export interface OCRResult {
  full_name: string | null;
  document_number: string | null;
  date_of_birth: string | null;
  extracted_text: string;
  confidence: number;
  document_type: DocumentType;
  success: boolean;
  error?: string;
}

export interface UserFormData {
  full_name?: string;
  nrc_number?: string;
  gov_id_number?: string;
  date_of_birth?: string;
}

const defaultOCRResult: OCRResult = {
  full_name: null,
  document_number: null,
  date_of_birth: null,
  extracted_text: "",
  confidence: 0,
  document_type: "nrc",
  success: false,
};

const log = (message: string, data?: unknown): void => {
  if (features.enableOCROLogging) console.log(`[OCR Service] ${message}`, data ?? "");
};

export const isValidFileType = (file: File): boolean => {
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
  return validTypes.includes(file.type);
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const extractPatterns = {
  names: (text: string): string[] => {
    const patterns = [
      /\b([A-Z][A-Z\s]{2,30})\b/g,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g,
    ];
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) matches.push(...found.filter(m => m.length > 3 && !m.includes("REPUBLIC")));
    });
    return [...new Set(matches)].slice(0, 5);
  },

  nrcNumber: (text: string): string | null => {
    const pattern = /\b(\d{6}\/\d{2}\/\d{1,2})\b/;
    const match = text.match(pattern);
    return match ? match[1] : null;
  },

  dates: (text: string): string[] => {
    const patterns = [
      /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/g,
      /\b(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g,
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
    ];
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) matches.push(...found);
    });
    return [...new Set(matches)];
  },

  idNumbers: (text: string): string[] => {
    const patterns = [
      /\b([A-Z]{1,2}\d{6,12})\b/g,
      /\b(?:EMP|EMP|Employee)?\.?\s*#?(\d{4,10})\b/gi,
      /\b(?:National|ID)?\.?\s*#?(\d{8,14})\b/gi,
    ];
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) matches.push(...found);
    });
    return [...new Set(matches)];
  },
};

const parseExtractedText = (text: string, documentType: DocumentType): Partial<OCRResult> => {
  const result: Partial<OCRResult> = { extracted_text: text };

  const names = extractPatterns.names(text);
  if (names.length > 0) result.full_name = names[0];

  switch (documentType) {
    case "nrc": {
      result.document_number = extractPatterns.nrcNumber(text);
      const dates = extractPatterns.dates(text);
      if (dates.length > 0) result.date_of_birth = dates[0];
      break;
    }
    case "government_id": {
      const idNumbers = extractPatterns.idNumbers(text);
      if (idNumbers.length > 0) result.document_number = idNumbers[0];
      break;
    }
    case "payslip": {
      const empNumbers = extractPatterns.idNumbers(text);
      if (empNumbers.length > 0) result.document_number = empNumbers[0];
      break;
    }
    default:
      result.document_number = extractPatterns.nrcNumber(text);
  }

  return result;
};

export const processDocument = async (
  file: File,
  documentType: DocumentType = "nrc"
): Promise<OCRResult> => {
  if (!features.enableOCR) {
    log("OCR processing is disabled via feature flag");
    return { ...defaultOCRResult, document_type: documentType };
  }

  if (!isValidFileType(file)) {
    log("Invalid file type for OCR", { type: file.type, name: file.name });
    return {
      ...defaultOCRResult,
      document_type: documentType,
      error: `Unsupported file type: ${file.type}`,
    };
  }

  try {
    log("Starting OCR processing", { fileName: file.name, documentType });
    const imageData = await fileToDataUrl(file);
    const result = await Tesseract.recognize(imageData, "eng", {
      logger: (m) => {
        if (features.enableOCROLogging && m.status === "recognizing text") {
          log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    const data = result.data;

    if (!data) {
      log("OCR processing failed");
      return { ...defaultOCRResult, document_type: documentType, error: "OCR processing failed" };
    }

    log("OCR processing completed", { confidence: data.confidence });
    const parsedData = parseExtractedText(data.text, documentType);

    return {
      full_name: parsedData.full_name ?? null,
      document_number: parsedData.document_number ?? null,
      date_of_birth: parsedData.date_of_birth ?? null,
      extracted_text: data.text,
      confidence: data.confidence,
      document_type: documentType,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("OCR processing error", { error: errorMessage });
    return { ...defaultOCRResult, document_type: documentType, error: errorMessage };
  }
};

export const processMultipleDocuments = async (
  files: { file: File; type: DocumentType }[]
): Promise<OCRResult[]> => {
  if (!features.enableOCR) return files.map((f) => ({ ...defaultOCRResult, document_type: f.type }));

  const results: OCRResult[] = [];
  for (const { file, type } of files) {
    results.push(await processDocument(file, type));
    if (files.indexOf({ file, type }) < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return results;
};

export const mergeOCRResults = (results: OCRResult[]): OCRResult => {
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  const primary = sorted[0];
  const merged: OCRResult = {
    full_name: primary.full_name,
    document_number: primary.document_number,
    date_of_birth: primary.date_of_birth,
    extracted_text: results.map((r) => r.extracted_text).join("\n\n---\n\n"),
    confidence: primary.confidence,
    document_type: primary.document_type,
    success: results.some((r) => r.success),
  };

  for (const result of sorted) {
    if (!merged.full_name && result.full_name) merged.full_name = result.full_name;
    if (!merged.document_number && result.document_number) merged.document_number = result.document_number;
    if (!merged.date_of_birth && result.date_of_birth) merged.date_of_birth = result.date_of_birth;
  }
  return merged;
};

export default { processDocument, processMultipleDocuments, mergeOCRResults, isValidFileType };
