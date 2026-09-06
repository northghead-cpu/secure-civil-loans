/** Strict, server-date-driven validation for the three latest completed payslip periods. */

export interface PayslipPeriod {
  year: number;
  month: number;
  key: string;
}

export interface PayslipPeriodValidation {
  valid: boolean;
  reason: string;
  detected: PayslipPeriod | null;
  required: PayslipPeriod[];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

const toKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

const periodFromDate = (date: Date): PayslipPeriod => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  key: toKey(date.getUTCFullYear(), date.getUTCMonth() + 1),
});

/** The three calendar months immediately before the application month. */
export const getRequiredPayslipPeriods = (applicationDate: Date): PayslipPeriod[] => {
  if (Number.isNaN(applicationDate.getTime())) throw new Error("Invalid application date");
  const year = applicationDate.getUTCFullYear();
  const monthIndex = applicationDate.getUTCMonth();
  return [3, 2, 1].map((offset) => periodFromDate(new Date(Date.UTC(year, monthIndex - offset, 1))));
};

/**
 * Parse a period extracted from OCR. Filename labels are deliberately excluded.
 * Returns null for ambiguous, incomplete or non-calendar period strings.
 */
export const parseOcrPayslipPeriod = (value: string | null | undefined): PayslipPeriod | null => {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  const match = normalized.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase() as typeof MONTHS[number]) + 1;
  const year = Number(match[2]);
  if (month < 1 || year < 1900 || year > 2200) return null;
  return { year, month, key: toKey(year, month) };
};

export const validatePayslipPeriod = (
  ocrPeriod: string | null | undefined,
  applicationDate: Date,
  ocrConfidence = 100,
  minimumConfidence = 70,
): PayslipPeriodValidation => {
  const required = getRequiredPayslipPeriods(applicationDate);
  const detected = parseOcrPayslipPeriod(ocrPeriod);
  if (!detected) return { valid: false, reason: "OCR could not establish a unique month and year.", detected: null, required };
  if (ocrConfidence < minimumConfidence) return { valid: false, reason: "OCR confidence is below the payslip-period threshold.", detected, required };
  if (!required.some((period) => period.key === detected.key)) {
    return { valid: false, reason: `Payslip period ${detected.key} is not one of the three latest completed calendar months.`, detected, required };
  }
  return { valid: true, reason: "Payslip period is valid.", detected, required };
};

export const validatePayslipSet = (
  periods: Array<string | null | undefined>,
  applicationDate: Date,
  ocrConfidence = 100,
): PayslipPeriodValidation => {
  const required = getRequiredPayslipPeriods(applicationDate);
  const parsed = periods.map((period) => parseOcrPayslipPeriod(period));
  if (parsed.some((period) => !period)) return { valid: false, reason: "Every payslip must contain an unambiguous OCR month and year.", detected: null, required };
  if (ocrConfidence < 70) return { valid: false, reason: "OCR confidence is below the payslip-period threshold.", detected: null, required };
  const keys = parsed.map((period) => period!.key);
  if (new Set(keys).size !== keys.length) return { valid: false, reason: "Each required payslip month must be distinct.", detected: null, required };
  if (keys.length !== 3 || required.some((period) => !keys.includes(period.key))) {
    return { valid: false, reason: "The uploaded payslips must exactly cover the three latest completed calendar months.", detected: null, required };
  }
  return { valid: true, reason: "All three required payslip periods are valid.", detected: null, required };
};
