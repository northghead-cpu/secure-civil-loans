/**
 * Payroll Parsing Service
 *
 * Extracts net salary, gross salary, deductions, employer name, and employee
 * number from payslip documents using the existing OCR pipeline.
 *
 * Designed for Zambian civil-servant payslips but handles generic formats too.
 */

import { processDocument, type OCRResult } from "@/services/ocrService";
import { features } from "@/config/features";

export interface PayrollParseResult {
  /** Gross salary amount (ZMW) */
  gross_salary: number | null;
  /** Total deductions amount (ZMW) */
  total_deductions: number | null;
  /** Net / take-home salary (ZMW) */
  net_salary: number | null;
  /** Employer or ministry name */
  employer: string | null;
  /** Employee / payroll number */
  employee_number: string | null;
  /** Pay period string if found */
  pay_period: string | null;
  /** Full name from payslip */
  full_name: string | null;
  /** Raw OCR text for debugging */
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
    console.log(`[Payroll Parser] ${msg}`, data ?? "");
  }
};

/* ------------------------------------------------------------------ */
/*  Extraction helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Extract a monetary amount that appears near a keyword.
 * Handles formats: 12,345.67 | 12345.67 | K12,345.67 | ZMW 12 345.67
 */
const extractAmountNear = (text: string, keywords: string[]): number | null => {
  for (const kw of keywords) {
    // Case-insensitive, allow colon/spaces between keyword and amount
    const re = new RegExp(
      `${kw}[:\\s]*[KZMWzmwk$]*\\s*([\\d][\\d\\s,]*\\.?\\d*)`,
      "i"
    );
    const match = text.match(re);
    if (match) {
      const cleaned = match[1].replace(/[,\s]/g, "");
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
};

/**
 * Extract employer / ministry name.
 * Looks for common payslip header patterns.
 */
const extractEmployer = (text: string): string | null => {
  const patterns = [
    /(?:REPUBLIC\s+OF\s+ZAMBIA[\s\S]*?)(MINISTRY\s+OF\s+[A-Z][A-Z\s&]*[A-Z])/i,
    /(MINISTRY\s+OF\s+[A-Z][A-Z\s&]*[A-Z])/i,
    /(?:employer|department|organisation|organization|company)[:\s]+([A-Za-z\s&,.-]{4,60})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = (m[1] ?? m[0]).trim().replace(/\s{2,}/g, " ");
      // Skip if it's just "OF" or too short
      if (val.length > 5) return val;
    }
  }
  return null;
};

/**
 * Extract employee / payroll number.
 */
const extractEmployeeNumber = (text: string): string | null => {
  const patterns = [
    /(?:employee\s*(?:no|number|#|id)|payroll\s*(?:no|number|#|id)|emp\s*(?:no|#))[:\s]*([A-Z0-9/-]{3,15})/i,
    /(?:staff\s*(?:no|number|#|id))[:\s]*([A-Z0-9/-]{3,15})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
};

/**
 * Extract pay period (month/year).
 */
const extractPayPeriod = (text: string): string | null => {
  const patterns = [
    /(?:pay\s*period|period|month|for\s+the\s+month\s+of)[:\s]*([A-Za-z]+\s*\d{4})/i,
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
};

/* ------------------------------------------------------------------ */
/*  Main parse function                                                */
/* ------------------------------------------------------------------ */

/**
 * Parse a payslip file and extract salary / employer details.
 *
 * @param file - The payslip image or PDF
 * @returns Parsed payroll data
 */
export const parsePayslip = async (file: File): Promise<PayrollParseResult> => {
  if (!features.enableOCR) {
    return {
      gross_salary: null,
      total_deductions: null,
      net_salary: null,
      employer: null,
      employee_number: null,
      pay_period: null,
      full_name: null,
      raw_text: "",
      confidence: 0,
      success: false,
      error: "OCR is disabled",
    };
  }

  try {
    log("Starting payslip parsing", { fileName: file.name });

    // Run OCR
    const ocr: OCRResult = await processDocument(file, "payslip");

    if (!ocr.success || !ocr.extracted_text) {
      return {
        gross_salary: null,
        total_deductions: null,
        net_salary: null,
        employer: null,
        employee_number: null,
        pay_period: null,
        full_name: ocr.full_name ?? null,
        raw_text: ocr.extracted_text ?? "",
        confidence: ocr.confidence,
        success: false,
        error: ocr.error ?? "OCR extraction failed",
      };
    }

    const text = ocr.extracted_text;

    // Extract fields
    const gross_salary = extractAmountNear(text, [
      "gross\\s*(?:salary|pay|earnings|income)",
      "total\\s*earnings",
      "basic\\s*salary",
    ]);

    const total_deductions = extractAmountNear(text, [
      "total\\s*deductions",
      "deductions\\s*total",
      "less\\s*deductions",
    ]);

    const net_salary = extractAmountNear(text, [
      "net\\s*(?:salary|pay|income|amount)",
      "take[\\s-]*home(?:\\s*pay)?",
      "amount\\s*payable",
      "net\\s*payable",
    ]);

    const employer = extractEmployer(text);
    const employee_number = extractEmployeeNumber(text) ?? ocr.document_number ?? null;
    const pay_period = extractPayPeriod(text);
    const full_name = ocr.full_name ?? null;

    const result: PayrollParseResult = {
      gross_salary,
      total_deductions,
      net_salary,
      employer,
      employee_number,
      pay_period,
      full_name,
      raw_text: text,
      confidence: ocr.confidence,
      success: true,
    };

    log("Payslip parsing complete", {
      net_salary,
      gross_salary,
      employer,
      employee_number,
      confidence: ocr.confidence,
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log("Payslip parsing error", { error: msg });
    return {
      gross_salary: null,
      total_deductions: null,
      net_salary: null,
      employer: null,
      employee_number: null,
      pay_period: null,
      full_name: null,
      raw_text: "",
      confidence: 0,
      success: false,
      error: msg,
    };
  }
};

export default { parsePayslip };
