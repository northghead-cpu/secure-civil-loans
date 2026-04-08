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

/**
 * Supported document types for OCR processing
 */
export type DocumentType = "nrc" | "payslip" | "bank_statement" | "government_id";

/**
 * Structured data extracted from documents via OCR
 */
export interface OCRResult {
  /** Full name extracted from the document */
  full_name: string | null;
  /** Document number (NRC, passport, etc.) */
  document_number: string | null;
  /** Date of birth if found on document */
  date_of_birth: string | null;
  /** Raw text extracted from the document */
  extracted_text: string;
  /** Confidence score of the OCR processing (0-100) */
  confidence: number;
  /** Type of document that was processed */
  document_type: DocumentType;
  /** Whether OCR processing succeeded */
  success: boolean;
  /** Error message if processing failed */
  error?: string;
}

/**
 * User-submitted form data for comparison with OCR results
 */
export interface UserFormData {
  full_name?: string;
  nrc_number?: string;
  gov_id_number?: string;
  date_of_birth?: string;
}

/**
 * Default OCR result for when processing fails or is disabled
 */
const defaultOCRResult: OCRResult = {
  full_name: null,
  document_number: null,
  date_of_birth: null,
  extracted_text: "",
  confidence: 0,
  document_type: "nrc",
  success: false,
};

/**
 * Log message if logging is enabled
 */
const log = (message: string, data?: unknown): void => {
  if (features.enableOCROLogging) {
    console.log(`[OCR Service] ${message}`, data ?? "");
  }
};

/**
 * Validate if the file type is supported for OCR
 */
export const isValidFileType = (file: File): boolean => {
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
  return validTypes.includes(file.type);
};

/**
 * Convert a File object to a data URL for OCR processing
 */
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Extract patterns from text using regex
 */
const extractPatterns = {
  /**
   * Extract potential names (capitalized words, common name patterns)
   * Works for Zambian names and similar formats
   */
  names: (text: string): string[] => {
    const patterns = [
      // Pattern for names like "CHOMBA CHIPETA" or "John Mwansa"
      /\b([A-Z][A-Z\s]{2,30})\b/g,
      // Pattern for names like "John Mumba Chanda"
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g,
    ];
    
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) {
        matches.push(...found.filter(m => m.length > 3 && !m.includes("REPUBLIC")));
      }
    });
    
    return [...new Set(matches)].slice(0, 5);
  },

  /**
   * Extract NRC number patterns (Zambian format: 123456/78/1)
   */
  nrcNumber: (text: string): string | null => {
    // Zambian NRC pattern: 6 digits / 2 digits / 1 digit
    const pattern = /\b(\d{6}\/\d{2}\/\d{1,2})\b/;
    const match = text.match(pattern);
    return match ? match[1] : null;
  },

  /**
   * Extract date patterns (various formats)
   */
  dates: (text: string): string[] => {
    const patterns = [
      // DD/MM/YYYY or DD-MM-YYYY
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
      // YYYY-MM-DD (ISO format)
      /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,
      // Month DD, YYYY
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
    ];
    
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) {
        matches.push(...found);
      }
    });
    
    return [...new Set(matches)];
  },

  /**
   * Extract potential ID numbers (passports, employee IDs, etc.)
   */
  idNumbers: (text: string): string[] => {
    const patterns = [
      // Passport numbers (alphanumeric, 6-12 chars)
      /\b([A-Z]{1,2}\d{6,12})\b/g,
      // Employee ID patterns
      /\b(?:EMP|EMP|Employee)?\.?\s*#?(\d{4,10})\b/gi,
      // National ID patterns
      /\b(?:National|ID)?\.?\s*#?(\d{8,14})\b/gi,
    ];
    
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) {
        matches.push(...found);
      }
    });
    
    return [...new Set(matches)];
  },
};

/**
 * Parse extracted text to find structured data
 */
const parseExtractedText = (text: string, documentType: DocumentType): Partial<OCRResult> => {
  const result: Partial<OCRResult> = {
    extracted_text: text,
  };

  // Extract names
  const names = extractPatterns.names(text);
  if (names.length > 0) {
    result.full_name = names[0];
  }

  // Extract document-specific data
  switch (documentType) {
    case "nrc":
      result.document_number = extractPatterns.nrcNumber(text);
      const dates = extractPatterns.dates(text);
      if (dates.length > 0) {
        result.date_of_birth = dates[0];
      }
      break;

    case "government_id":
      const idNumbers = extractPatterns.idNumbers(text);
      if (idNumbers.length > 0) {
        result.document_number = idNumbers[0];
      }
      break;

    case "payslip":
      // Extract employee number from payslip
      const empNumbers = extractPatterns.idNumbers(text);
      if (empNumbers.length > 0) {
        result.document_number = empNumbers[0];
      }
      break;

    default:
      // For unknown types, try general extraction
      result.document_number = extractPatterns.nrcNumber(text);
  }

  return result;
};

/**
 * Process a document file using OCR
 * 
 * @param file - The file to process (PNG, JPG, JPEG, or PDF)
 * @param documentType - Type of document being processed
 * @returns Promise<OCRResult> with extracted data or null on failure
 * 
 * @example
 * ```typescript
 * const file = event.target.files[0];
 * const result = await processDocument(file, 'nrc');
 * if (result?.success) {
 *   console.log('Extracted name:', result.full_name);
 * }
 * ```
 */
export const processDocument = async (
  file: File,
  documentType: DocumentType = "nrc"
): Promise<OCRResult> => {
  // Check if feature is enabled
  if (!features.enableOCR) {
    log("OCR processing is disabled via feature flag");
    return { ...defaultOCRResult, document_type: documentType };
  }

  // Validate file type
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

    // Convert file to data URL for Tesseract processing
    const imageData = await fileToDataUrl(file);

    // Perform OCR using Tesseract.js
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
      return {
        ...defaultOCRResult,
        document_type: documentType,
        error: "OCR processing failed",
      };
    }

    log("OCR processing completed", {
      confidence: data.confidence,
    });

    // Parse the extracted text to find structured data
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

    return {
      ...defaultOCRResult,
      document_type: documentType,
      error: errorMessage,
    };
  }
};

/**
 * Process multiple documents in sequence
 * Useful for processing NRC front and back, or multiple document types
 */
export const processMultipleDocuments = async (
  files: { file: File; type: DocumentType }[]
): Promise<OCRResult[]> => {
  if (!features.enableOCR) {
    return files.map((f) => ({ ...defaultOCRResult, document_type: f.type }));
  }

  const results: OCRResult[] = [];

  for (const { file, type } of files) {
    const result = await processDocument(file, type);
    results.push(result);
    
    // Small delay between processing to prevent resource contention
    if (files.indexOf({ file, type }) < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
};

/**
 * Merge OCR results from multiple documents
 * Useful when processing NRC front and back together
 */
export const mergeOCRResults = (results: OCRResult[]): OCRResult => {
  // Start with the result with highest confidence
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  const primary = sorted[0];

  // Merge data from all results, preferring non-null values from higher confidence
  const merged: OCRResult = {
    full_name: primary.full_name,
    document_number: primary.document_number,
    date_of_birth: primary.date_of_birth,
    extracted_text: results.map((r) => r.extracted_text).join("\n\n---\n\n"),
    confidence: primary.confidence,
    document_type: primary.document_type,
    success: results.some((r) => r.success),
  };

  // Fill in any null values from other results
  for (const result of sorted) {
    if (!merged.full_name && result.full_name) merged.full_name = result.full_name;
    if (!merged.document_number && result.document_number) merged.document_number = result.document_number;
    if (!merged.date_of_birth && result.date_of_birth) merged.date_of_birth = result.date_of_birth;
  }

  return merged;
};

export default {
  processDocument,
  processMultipleDocuments,
  mergeOCRResults,
  isValidFileType,
};
