/**
 * Fraud Detection Engine
 * 
 * Analyzes OCR-extracted data against user-submitted form data to detect
 * potential inconsistencies and fraudulent submissions.
 * 
 * This service is designed to be non-blocking and fail-safe - it will never
 * throw errors or block user actions if fraud detection fails.
 */

import { features } from "@/config/features";
import type { OCRResult } from "./ocrService";

/**
 * Risk levels for fraud detection
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * Individual fraud flag/warning
 */
export interface FraudFlag {
  /** Unique identifier for the flag type */
  type: FraudFlagType;
  /** Human-readable description of the issue */
  message: string;
  /** Severity weight of this flag (contributes to fraud_score) */
  weight: number;
  /** Field that triggered the flag */
  field?: string;
  /** Expected value vs actual value */
  details?: {
    expected?: string;
    actual?: string;
  };
}

/**
 * Types of fraud flags that can be detected
 */
export type FraudFlagType =
  | "NAME_MISMATCH"
  | "ID_NUMBER_MISMATCH"
  | "SUSPICIOUS_FORMATTING"
  | "DUPLICATE_SUBMISSION"
  | "MISSING_CRITICAL_FIELD"
  | "LOW_OCR_CONFIDENCE"
  | "DOCUMENT_TAMPERING"
  | "DATE_INCONSISTENCY";

/**
 * Fraud detection result
 */
export interface FraudDetectionResult {
  /** Overall fraud score (0-100) */
  fraud_score: number;
  /** Risk level classification */
  risk_level: RiskLevel;
  /** Array of detected issues */
  flags: FraudFlag[];
  /** Whether fraud detection completed successfully */
  success: boolean;
  /** Error message if detection failed */
  error?: string;
  /** Timestamp of when detection ran */
  timestamp: string;
}

/**
 * Input data for fraud detection
 */
export interface FraudDetectionInput {
  /** OCR extracted data from document */
  ocrData: OCRResult | null;
  /** User-submitted form data */
  userFormData: {
    full_name?: string;
    nrc_number?: string;
    gov_id_number?: string;
    date_of_birth?: string;
    gov_id_type?: string;
  };
  /** Optional: existing submissions to check for duplicates */
  existingSubmissions?: {
    nrc_number?: string;
    gov_id_number?: string;
    user_id?: string;
  }[];
  /** Optional: document ID for duplicate checking */
  documentId?: string;
}

/**
 * Default fraud detection result for when detection fails or is disabled
 */
const defaultFraudResult: FraudDetectionResult = {
  fraud_score: 0,
  risk_level: "low",
  flags: [],
  success: false,
  timestamp: new Date().toISOString(),
};

/**
 * Log message if logging is enabled
 */
const log = (message: string, data?: unknown): void => {
  if (features.enableOCROLogging) {
    console.log(`[Fraud Detection] ${message}`, data ?? "");
  }
};

/**
 * Normalize a string for comparison (remove extra spaces, convert to lowercase)
 */
const normalizeString = (str: string | null | undefined): string => {
  if (!str) return "";
  return str.toLowerCase().replace(/\s+/g, " ").trim();
};

/**
 * Calculate string similarity ratio (0-1)
 */
const stringSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Simple character-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  const matches = [...shorter].filter((char) => longer.includes(char)).length;
  return matches / longer.length;
};

/**
 * Check for name mismatch between OCR and user input
 */
const checkNameMismatch = (
  ocrName: string | null,
  userName: string | undefined
): FraudFlag | null => {
  if (!ocrName || !userName) return null;

  const similarity = stringSimilarity(ocrName, userName);
  
  // Names match if similarity is > 0.7
  if (similarity < 0.7) {
    return {
      type: "NAME_MISMATCH",
      message: `Name mismatch detected. OCR extracted "${ocrName}" but user submitted "${userName}". Similarity: ${Math.round(similarity * 100)}%`,
      weight: 35,
      field: "full_name",
      details: {
        expected: ocrName,
        actual: userName,
      },
    };
  }

  return null;
};

/**
 * Check for ID number mismatch between OCR and user input
 */
const checkIdMismatch = (
  ocrId: string | null,
  userId: string | undefined
): FraudFlag | null => {
  if (!ocrId || !userId) return null;

  const normalizedOcr = normalizeString(ocrId);
  const normalizedUser = normalizeString(userId);

  // Direct comparison first
  if (normalizedOcr === normalizedUser) return null;

  // Check if numbers match (ignoring formatting)
  const extractNumbers = (str: string) => str.replace(/\D/g, "");
  const ocrNumbers = extractNumbers(normalizedOcr);
  const userNumbers = extractNumbers(normalizedUser);

  if (ocrNumbers && userNumbers && ocrNumbers !== userNumbers) {
    return {
      type: "ID_NUMBER_MISMATCH",
      message: `ID number mismatch detected. OCR extracted "${ocrId}" but user submitted "${userId}".`,
      weight: 40,
      field: "document_number",
      details: {
        expected: ocrId,
        actual: userId,
      },
    };
  }

  return null;
};

/**
 * Check for suspicious formatting patterns
 */
const checkSuspiciousFormatting = (
  text: string,
  field: string,
  value: string | null
): FraudFlag | null => {
  if (!value) return null;

  const suspiciousPatterns = [
    { pattern: /(.)\1{4,}/g, name: "repeated_characters", weight: 15 }, // Same character repeated 5+ times
    { pattern: /[0-9]{10,}/g, name: "excessive_numbers", weight: 10 }, // Too many numbers
    { pattern: /[A-Z]{15,}/g, name: "excessive_caps", weight: 10 }, // All caps for long strings
  ];

  for (const { pattern, name, weight } of suspiciousPatterns) {
    if (pattern.test(value)) {
      return {
        type: "SUSPICIOUS_FORMATTING",
        message: `Suspicious formatting detected in ${field}: ${name}`,
        weight,
        field,
        details: {
          actual: value,
        },
      };
    }
  }

  // Check for suspicious spacing or unusual characters
  if (/[^\w\s\/\-\.]/g.test(value)) {
    return {
      type: "SUSPICIOUS_FORMATTING",
      message: `Unusual characters detected in ${field}`,
      weight: 15,
      field,
      details: {
        actual: value,
      },
    };
  }

  return null;
};

/**
 * Check for missing critical fields
 */
const checkMissingFields = (
  ocrData: OCRResult | null,
  userFormData: FraudDetectionInput["userFormData"]
): FraudFlag[] => {
  const flags: FraudFlag[] = [];

  // If OCR processing failed or returned no data, flag it
  if (!ocrData || !ocrData.success) {
    if (!ocrData?.extracted_text || ocrData.extracted_text.length < 10) {
      flags.push({
        type: "MISSING_CRITICAL_FIELD",
        message: "OCR processing returned insufficient data or failed",
        weight: 25,
        field: "document_content",
      });
    }
  }

  // Check for low OCR confidence
  if (ocrData && ocrData.confidence < 60) {
    flags.push({
      type: "LOW_OCR_CONFIDENCE",
      message: `Low OCR confidence score: ${Math.round(ocrData.confidence)}%`,
      weight: 20,
      field: "document_content",
    });
  }

  return flags;
};

/**
 * Check for duplicate submissions
 */
const checkDuplicates = (
  userId: string | undefined,
  existingSubmissions: FraudDetectionInput["existingSubmissions"] = []
): FraudFlag[] => {
  const flags: FraudFlag[] = [];

  if (!userId || existingSubmissions.length === 0) return flags;

  // Check if this user has submitted before
  const userSubmissions = existingSubmissions.filter((s) => s.user_id === userId);
  if (userSubmissions.length > 0) {
    flags.push({
      type: "DUPLICATE_SUBMISSION",
      message: `User has ${userSubmissions.length} existing submission(s)`,
      weight: 30,
    });
  }

  // Check for duplicate ID numbers
  const idNumbers = existingSubmissions
    .map((s) => s.nrc_number || s.gov_id_number)
    .filter(Boolean);

  if (new Set(idNumbers).size < idNumbers.length) {
    flags.push({
      type: "DUPLICATE_SUBMISSION",
      message: "Duplicate ID numbers detected across submissions",
      weight: 40,
    });
  }

  return flags;
};

/**
 * Check for date inconsistencies
 */
const checkDateInconsistency = (
  ocrDate: string | null,
  userDate: string | undefined
): FraudFlag | null => {
  if (!ocrDate || !userDate) return null;

  // Try to normalize and compare dates
  const parseDate = (dateStr: string): Date | null => {
    // Try various date formats
    const formats = [
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/, // DD/MM/YYYY or DD-MM-YYYY
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // YYYY/MM/DD or YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          // Try to create a date object
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) return parsed;
        } catch {
          // Continue to next format
        }
      }
    }
    return null;
  };

  const ocrParsedDate = parseDate(ocrDate);
  const userParsedDate = parseDate(userDate);

  if (ocrParsedDate && userParsedDate) {
    // Check if dates are significantly different (more than 1 year apart)
    const diffYears = Math.abs(
      (ocrParsedDate.getTime() - userParsedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    if (diffYears > 1) {
      return {
        type: "DATE_INCONSISTENCY",
        message: `Date of birth mismatch. OCR: ${ocrDate}, User: ${userDate}`,
        weight: 25,
        field: "date_of_birth",
        details: {
          expected: ocrDate,
          actual: userDate,
        },
      };
    }
  }

  return null;
};

/**
 * Calculate overall fraud score and risk level
 */
const calculateRiskLevel = (
  flags: FraudFlag[]
): { fraud_score: number; risk_level: RiskLevel } => {
  // Sum up all flag weights
  const totalWeight = flags.reduce((sum, flag) => sum + flag.weight, 0);

  // Cap at 100
  const fraud_score = Math.min(100, totalWeight);

  // Determine risk level
  let risk_level: RiskLevel;
  if (fraud_score >= 60) {
    risk_level = "high";
  } else if (fraud_score >= 30) {
    risk_level = "medium";
  } else {
    risk_level = "low";
  }

  return { fraud_score, risk_level };
};

/**
 * Analyze OCR and user data for potential fraud
 * 
 * @param input - Contains OCR data, user form data, and optional existing submissions
 * @returns FraudDetectionResult with score, risk level, and flags
 * 
 * @example
 * ```typescript
 * const result = await analyzeForFraud({
 *   ocrData: ocrResult,
 *   userFormData: { full_name: "John Doe", nrc_number: "123456/78/1" }
 * });
 * 
 * if (result.risk_level === "high") {
 *   // Flag for manual review
 * }
 * ```
 */
export const analyzeForFraud = async (
  input: FraudDetectionInput
): Promise<FraudDetectionResult> => {
  const startTime = Date.now();

  // Check if feature is enabled
  if (!features.enableFraudDetection) {
    log("Fraud detection is disabled via feature flag");
    return {
      ...defaultFraudResult,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    log("Starting fraud analysis", { input });

    const flags: FraudFlag[] = [];

    // Run all fraud checks
    const ocrData = input.ocrData;
    const userFormData = input.userFormData;

    // 1. Check name mismatch
    const nameFlag = checkNameMismatch(
      ocrData?.full_name ?? null,
      userFormData.full_name
    );
    if (nameFlag) flags.push(nameFlag);

    // 2. Check ID number mismatch (check both NRC and government ID)
    const nrcFlag = checkIdMismatch(
      ocrData?.document_number ?? null,
      userFormData.nrc_number
    );
    if (nrcFlag) flags.push(nrcFlag);

    const govIdFlag = checkIdMismatch(
      ocrData?.document_number ?? null,
      userFormData.gov_id_number
    );
    if (govIdFlag) flags.push(govIdFlag);

    // 3. Check for suspicious formatting in user-submitted data
    if (userFormData.full_name) {
      const formattingFlag = checkSuspiciousFormatting(
        userFormData.full_name,
        "full_name",
        userFormData.full_name
      );
      if (formattingFlag) flags.push(formattingFlag);
    }

    if (userFormData.nrc_number) {
      const formattingFlag = checkSuspiciousFormatting(
        userFormData.nrc_number,
        "nrc_number",
        userFormData.nrc_number
      );
      if (formattingFlag) flags.push(formattingFlag);
    }

    // 4. Check for missing/insufficient fields
    const missingFlags = checkMissingFields(ocrData, userFormData);
    flags.push(...missingFlags);

    // 5. Check for duplicates
    const duplicateFlags = checkDuplicates(
      input.documentId,
      input.existingSubmissions
    );
    flags.push(...duplicateFlags);

    // 6. Check date inconsistency
    const dateFlag = checkDateInconsistency(
      ocrData?.date_of_birth ?? null,
      userFormData.date_of_birth
    );
    if (dateFlag) flags.push(dateFlag);

    // Calculate final score and risk level
    const { fraud_score, risk_level } = calculateRiskLevel(flags);

    const result: FraudDetectionResult = {
      fraud_score,
      risk_level,
      flags,
      success: true,
      timestamp: new Date().toISOString(),
    };

    log("Fraud analysis completed", {
      score: fraud_score,
      risk_level,
      flagCount: flags.length,
      duration: `${Date.now() - startTime}ms`,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("Fraud detection error", { error: errorMessage });

    return {
      ...defaultFraudResult,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Quick fraud score check (simplified version without full analysis)
 * Useful for pre-screening before full analysis
 */
export const quickFraudCheck = (
  ocrData: OCRResult | null,
  userFormData: FraudDetectionInput["userFormData"]
): { risk_level: RiskLevel; immediateFlags: FraudFlag[] } => {
  const immediateFlags: FraudFlag[] = [];

  if (!ocrData || !ocrData.success) {
    immediateFlags.push({
      type: "MISSING_CRITICAL_FIELD",
      message: "No valid OCR data available",
      weight: 30,
      field: "document_content",
    });
  }

  if (ocrData?.confidence && ocrData.confidence < 50) {
    immediateFlags.push({
      type: "LOW_OCR_CONFIDENCE",
      message: `Very low OCR confidence: ${Math.round(ocrData.confidence)}%`,
      weight: 25,
      field: "document_content",
    });
  }

  // Quick name check
  const nameFlag = checkNameMismatch(ocrData?.full_name ?? null, userFormData.full_name);
  if (nameFlag) immediateFlags.push(nameFlag);

  // Quick ID check
  const idFlag = checkIdMismatch(ocrData?.document_number ?? null, userFormData.nrc_number);
  if (idFlag) immediateFlags.push(idFlag);

  // Calculate risk level
  const { risk_level } = calculateRiskLevel(immediateFlags);

  return { risk_level, immediateFlags };
};

export default {
  analyzeForFraud,
  quickFraudCheck,
};
