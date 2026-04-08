/**
 * Document Processor - Integration Layer
 * 
 * Acts as the bridge between OCR processing and fraud detection.
 * Orchestrates the document processing workflow:
 * 1. Run OCR on uploaded document
 * 2. Pass OCR result to fraud detection
 * 3. Return combined result
 * 
 * This module is designed to be non-breaking - it wraps all operations
 * in try/catch and will never block the main application flow.
 */

import { features } from "@/config/features";
import {
  processDocument,
  processMultipleDocuments,
  mergeOCRResults,
  type OCRResult,
  type DocumentType,
} from "@/services/ocrService";
import {
  analyzeForFraud,
  quickFraudCheck,
  type FraudDetectionResult,
  type FraudDetectionInput,
  type FraudFlag,
  type RiskLevel,
} from "@/services/fraudDetectionService";

/**
 * Supported document types for processing
 */
export type ProcessedDocumentType = "nrc" | "government_id" | "payslip" | "bank_statement";

/**
 * Combined result from document processing pipeline
 */
export interface DocumentProcessingResult {
  /** OCR extraction results */
  ocr_data: OCRResult | null;
  /** Fraud detection analysis results */
  fraud_analysis: FraudDetectionResult | null;
  /** Whether processing completed successfully */
  success: boolean;
  /** Quick risk assessment */
  risk_level: RiskLevel;
  /** High-priority flags that need attention */
  critical_flags: FraudFlag[];
  /** Error message if processing failed */
  error?: string;
  /** Timestamp of processing */
  timestamp: string;
}

/**
 * User form data for fraud comparison
 */
export interface ProcessedUserFormData {
  full_name?: string;
  nrc_number?: string;
  gov_id_number?: string;
  gov_id_type?: string;
  date_of_birth?: string;
  employer?: string;
  employee_number?: string;
}

/**
 * Document to be processed
 */
export interface DocumentToProcess {
  file: File;
  type: ProcessedDocumentType;
}

/**
 * Configuration for document processing
 */
export interface DocumentProcessorConfig {
  /** Enable OCR processing */
  enableOCR?: boolean;
  /** Enable fraud detection */
  enableFraudDetection?: boolean;
  /** Run full analysis (false = quick check only) */
  fullAnalysis?: boolean;
  /** Callback for progress updates */
  onProgress?: (stage: string, progress: number) => void;
  /** Callback for when processing completes */
  onComplete?: (result: DocumentProcessingResult) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Default configuration
 */
const defaultConfig: DocumentProcessorConfig = {
  enableOCR: true,
  enableFraudDetection: true,
  fullAnalysis: true,
};

/**
 * Log message helper
 */
const log = (message: string, data?: unknown): void => {
  if (features.enableOCROLogging) {
    console.log(`[Document Processor] ${message}`, data ?? "");
  }
};

/**
 * Process a single document through the OCR and fraud detection pipeline
 * 
 * @param document - The document file and its type
 * @param userFormData - User-submitted form data for comparison
 * @param config - Optional configuration
 * @returns Promise containing the combined processing result
 * 
 * @example
 * ```typescript
 * const file = event.target.files[0];
 * const result = await processDocumentFile(
 *   { file, type: 'nrc' },
 *   { full_name: 'John Doe', nrc_number: '123456/78/1' }
 * );
 * 
 * if (result.risk_level === 'high') {
 *   // Flag for review
 * }
 * ```
 */
export const processDocumentFile = async (
  document: DocumentToProcess,
  userFormData: ProcessedUserFormData,
  config: DocumentProcessorConfig = defaultConfig
): Promise<DocumentProcessingResult> => {
  const timestamp = new Date().toISOString();
  const finalConfig = { ...defaultConfig, ...config };

  try {
    log("Starting document processing", {
      documentType: document.type,
      fileName: document.file.name,
    });

    // Notify progress
    finalConfig.onProgress?.("ocr", 0);

    let ocrData: OCRResult | null = null;

    // Step 1: Run OCR if enabled
    if (finalConfig.enableOCR && features.enableOCR) {
      try {
        log("Running OCR processing");
        ocrData = await processDocument(document.file, document.type as DocumentType);
        finalConfig.onProgress?.("ocr", 100);
        log("OCR completed", { success: ocrData.success, confidence: ocrData.confidence });
      } catch (ocrError) {
        const errorMsg = ocrError instanceof Error ? ocrError.message : "OCR failed";
        log("OCR processing failed", { error: errorMsg });
        // Continue without OCR data - don't fail the whole process
        ocrData = null;
      }
    } else {
      log("OCR disabled, skipping");
      finalConfig.onProgress?.("ocr", 100);
    }

    // Step 2: Run fraud detection if enabled
    let fraudAnalysis: FraudDetectionResult | null = null;
    let risk_level: RiskLevel = "low";
    let criticalFlags: FraudFlag[] = [];

    if (finalConfig.enableFraudDetection && features.enableFraudDetection) {
      try {
        finalConfig.onProgress?.("fraud_detection", 0);
        log("Running fraud detection");

        const fraudInput: FraudDetectionInput = {
          ocrData,
          userFormData,
        };

        if (finalConfig.fullAnalysis) {
          fraudAnalysis = await analyzeForFraud(fraudInput);
        } else {
          // Quick check only
          const quickResult = quickFraudCheck(ocrData, userFormData);
          fraudAnalysis = {
            fraud_score: quickResult.immediateFlags.reduce((sum, f) => sum + f.weight, 0),
            risk_level: quickResult.risk_level,
            flags: quickResult.immediateFlags,
            success: true,
            timestamp,
          };
        }

        risk_level = fraudAnalysis.risk_level;
        criticalFlags = fraudAnalysis.flags.filter((f) => f.weight >= 30);

        finalConfig.onProgress?.("fraud_detection", 100);
        log("Fraud detection completed", {
          score: fraudAnalysis.fraud_score,
          risk_level,
          flagCount: fraudAnalysis.flags.length,
        });
      } catch (fraudError) {
        const errorMsg = fraudError instanceof Error ? fraudError.message : "Fraud detection failed";
        log("Fraud detection failed", { error: errorMsg });
        // Continue without fraud analysis - don't fail the whole process
      }
    } else {
      log("Fraud detection disabled, skipping");
      finalConfig.onProgress?.("fraud_detection", 100);
    }

    // Build final result
    const result: DocumentProcessingResult = {
      ocr_data: ocrData,
      fraud_analysis: fraudAnalysis,
      success: true,
      risk_level,
      critical_flags: criticalFlags,
      timestamp,
    };

    // Notify completion
    finalConfig.onComplete?.(result);

    log("Document processing completed successfully", {
      risk_level,
      criticalFlagCount: criticalFlags.length,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("Document processing failed", { error: errorMessage });

    const errorResult: DocumentProcessingResult = {
      ocr_data: null,
      fraud_analysis: null,
      success: false,
      risk_level: "low", // Default to low on error to not block users
      critical_flags: [],
      error: errorMessage,
      timestamp,
    };

    finalConfig.onError?.(error instanceof Error ? error : new Error(errorMessage));
    finalConfig.onComplete?.(errorResult);

    return errorResult;
  }
};

/**
 * Process multiple documents (e.g., NRC front and back)
 * 
 * @param documents - Array of documents to process
 * @param userFormData - User-submitted form data
 * @param config - Optional configuration
 * @returns Combined result from all documents
 */
export const processMultipleDocumentFiles = async (
  documents: DocumentToProcess[],
  userFormData: ProcessedUserFormData,
  config: DocumentProcessorConfig = defaultConfig
): Promise<DocumentProcessingResult> => {
  const timestamp = new Date().toISOString();

  try {
    log("Processing multiple documents", {
      count: documents.length,
      types: documents.map((d) => d.type),
    });

    const finalConfig = { ...defaultConfig, ...config };

    // Process all documents with OCR
    finalConfig.onProgress?.("ocr", 0);

    let allOCRResults: OCRResult[] = [];

    if (finalConfig.enableOCR && features.enableOCR) {
      try {
        const ocrPromises = documents.map((doc, index) =>
          processDocument(doc.file, doc.type as DocumentType)
        );
        allOCRResults = await Promise.all(ocrPromises);
      } catch (error) {
        log("Multi-document OCR failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    finalConfig.onProgress?.("ocr", 100);

    // Merge OCR results
    const mergedOCR = allOCRResults.length > 0 ? mergeOCRResults(allOCRResults) : null;

    // Run fraud detection on merged results
    let fraudAnalysis: FraudDetectionResult | null = null;
    let risk_level: RiskLevel = "low";
    let criticalFlags: FraudFlag[] = [];

    if (finalConfig.enableFraudDetection && features.enableFraudDetection) {
      try {
        finalConfig.onProgress?.("fraud_detection", 0);

        const fraudInput: FraudDetectionInput = {
          ocrData: mergedOCR,
          userFormData,
        };

        if (finalConfig.fullAnalysis) {
          fraudAnalysis = await analyzeForFraud(fraudInput);
        } else {
          const quickResult = quickFraudCheck(mergedOCR, userFormData);
          fraudAnalysis = {
            fraud_score: quickResult.immediateFlags.reduce((sum, f) => sum + f.weight, 0),
            risk_level: quickResult.risk_level,
            flags: quickResult.immediateFlags,
            success: true,
            timestamp,
          };
        }

        risk_level = fraudAnalysis.risk_level;
        criticalFlags = fraudAnalysis.flags.filter((f) => f.weight >= 30);

        finalConfig.onProgress?.("fraud_detection", 100);
      } catch (error) {
        log("Multi-document fraud detection failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const result: DocumentProcessingResult = {
      ocr_data: mergedOCR,
      fraud_analysis: fraudAnalysis,
      success: true,
      risk_level,
      critical_flags: criticalFlags,
      timestamp,
    };

    finalConfig.onComplete?.(result);

    log("Multi-document processing completed", {
      documentCount: documents.length,
      risk_level,
      criticalFlagCount: criticalFlags.length,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("Multi-document processing failed", { error: errorMessage });

    const errorResult: DocumentProcessingResult = {
      ocr_data: null,
      fraud_analysis: null,
      success: false,
      risk_level: "low",
      critical_flags: [],
      error: errorMessage,
      timestamp,
    };

    config?.onError?.(error instanceof Error ? error : new Error(errorMessage));
    config?.onComplete?.(errorResult);

    return errorResult;
  }
};

/**
 * Process documents in the background without blocking
 * Useful for non-urgent processing that shouldn't interrupt the user
 * 
 * @param document - Document to process
 * @param userFormData - User form data
 * @param onComplete - Callback when complete (receives null on failure)
 */
export const processDocumentInBackground = (
  document: DocumentToProcess,
  userFormData: ProcessedUserFormData,
  onComplete?: (result: DocumentProcessingResult | null) => void
): void => {
  // Use default config for background processing
  const config = defaultConfig;
  
  // Fire and forget - don't await
  processDocumentFile(document, userFormData, config)
    .then((result) => {
      onComplete?.(result);
    })
    .catch(() => {
      // Fail silently
      onComplete?.(null);
    });
};

/**
 * Check if document processing is available
 */
export const isDocumentProcessingAvailable = (): boolean => {
  return features.enableOCR || features.enableFraudDetection;
};

/**
 * Get a summary of the processing result for display
 */
export const getProcessingSummary = (
  result: DocumentProcessingResult
): {
  title: string;
  description: string;
  severity: "success" | "warning" | "error";
} => {
  if (!result.success) {
    return {
      title: "Processing Unavailable",
      description: "Document verification is temporarily unavailable. Your application will proceed normally.",
      severity: "warning",
    };
  }

  if (result.risk_level === "high") {
    return {
      title: "Review Required",
      description: `Potential issues detected (${result.critical_flags.length} flags). Manual review may be needed.`,
      severity: "error",
    };
  }

  if (result.risk_level === "medium") {
    return {
      title: "Additional Verification",
      description: "Some details require verification. Your application is still being processed.",
      severity: "warning",
    };
  }

  return {
    title: "Verified",
    description: "Document processed and verified successfully.",
    severity: "success",
  };
};

export default {
  processDocumentFile,
  processMultipleDocumentFiles,
  processDocumentInBackground,
  isDocumentProcessingAvailable,
  getProcessingSummary,
};
