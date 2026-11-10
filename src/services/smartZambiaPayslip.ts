// Layout reference confirmed by the owner; a layout match is not issuer verification.
export interface PayslipReviewFlag { code: string; message: string }
export interface SmartZambiaPayslip {
  layout: "smart_zambia_reference";
  gross_salary: number | null;
  total_deductions: number | null;
  net_salary: number | null;
  employee_number: string | null;
  nrc_number: string | null;
  full_name: string | null;
  employer: string;
  pay_period: string | null;
  review_flags: PayslipReviewFlag[];
}

/** Accept decimal-comma and decimal-point accounting amounts without guessing malformed input. */
export function parsePayrollAmount(value: string): number | null {
  const raw = value.trim().replace(/\u2212/g, "-");
  const negative = raw.startsWith("-") || raw.endsWith("-");
  const unsigned = raw.replace(/^-|-$/g, "").replace(/[ \u00a0]/g, "");
  let normalized: string;
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(unsigned)) normalized = unsigned.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(unsigned)) normalized = unsigned.replace(/,/g, "");
  else if (/^\d+[.,]\d{2}$/.test(unsigned)) normalized = unsigned.replace(",", ".");
  else if (/^\d+$/.test(unsigned)) normalized = unsigned;
  else return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? (negative ? -cents : cents) / 100 : null;
}

const amounts = (line: string): number[] => line.split(/\s+/).flatMap(token => {
  if (!/[.,]\d{2}-?$/.test(token)) return [];
  const amount = parsePayrollAmount(token);
  return amount == null ? [] : [amount];
});
const cents = (value: number) => Math.round(value * 100);
const differs = (a: number, b: number) => Math.abs(cents(a) - cents(b)) > 2;

export function parseSmartZambiaPayslip(text: string, confidence: number): SmartZambiaPayslip | null {
  if (!/GOVERNMENT\s+OF\s+THE\s+REPUBLIC\s+OF\s+ZAMBIA/i.test(text) || !/E[ -]?Payslip/i.test(text)) return null;
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const flags: PayslipReviewFlag[] = [];
  const add = (code: string, message: string) => flags.push({ code, message });
  const payIndex = lines.findIndex(line => /\bPAY\s+MONTH\b/i.test(line));
  const payLine = payIndex < 0 ? "" : lines.slice(payIndex, payIndex + 2).join(" ");
  const date = payLine.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  let period: string | null = null;
  if (date) {
    const [year, month, day] = date.slice(1).map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (year >= 1900 && year <= 2200 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      period = parsed.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    }
  }
  const idIndex = lines.findIndex(line => /EMPLOYEE\s+NO\.?\s+NRC\b/i.test(line));
  const idLine = idIndex < 0 ? "" : lines[idIndex + 1] ?? "";
  const identifiers = idLine.match(/^(\d{3,15})\s+(\d{6}\s*\/\s*\d{2}\s*\/\s*\d)\b/);
  const nameLine = lines.find(line => /^(?:MR|MRS|MS|MISS|DR|PROF)\.?\s+/i.test(line));
  const name = nameLine?.replace(/^(?:MR|MRS|MS|MISS|DR|PROF)\.?\s+/i, "")
    .split(/\s{2,}|\s+(?=(?:ZAMBIA\s+NATIONA[L]?\s+COMMERCIAL\s+BANK|ZANACO)\b)/i)[0].trim() ?? null;
  const fullName = name && /^[\p{L} .’'-]{4,100}$/u.test(name) && !/\b(?:BANK|PAYSLIP|SYNTHETIC|TEST)\b/i.test(name) ? name : null;
  const totalLines = lines.filter(line => /^Totals\b/i.test(line));
  const total = totalLines.length === 1 ? amounts(totalLines[0]) : [];
  const netLines = lines.filter(line => /^NET\s+PAY\b/i.test(line));
  const net = netLines.length === 1 ? amounts(netLines[0]) : [];
  const gross = total.length === 2 ? total[0] : null;
  const deductions = total.length === 2 ? Math.abs(total[1]) : null;
  const netPay = net.length === 1 ? net[0] : null;
  if (!Number.isFinite(confidence) || confidence < 70) add("LOW_OCR_CONFIDENCE", "OCR confidence requires manual review.");
  if (!period || !identifiers || !fullName || gross == null || deductions == null || netPay == null) add("MISSING_FIELDS", "One or more required payroll fields could not be read unambiguously.");
  if (gross != null && deductions != null && netPay != null && differs(gross - deductions, netPay)) add("TOTALS_MISMATCH", "Gross earnings minus deductions does not match net pay.");
  if ((gross != null && gross < 0) || (netPay != null && netPay < 0)) add("NEGATIVE_TOTAL", "A negative earnings or net-pay total requires review.");
  const headerIndex = lines.findIndex(line => /Code\s+Description\s+Period\s+Payment\s+Amount\s+Deduction\s+Amount/i.test(line));
  const totalIndex = lines.findIndex(line => /^Totals\b/i.test(line));
  let earningCents = 0, deductionCents = 0, rows = 0, unreadable = false;
  if (headerIndex >= 0 && totalIndex > headerIndex) {
    for (const line of lines.slice(headerIndex + 1, totalIndex)) {
      if (!/^[A-Z0-9/]{3,5}\s+/i.test(line)) continue;
      const values = amounts(line);
      if (values.length < 1 || values.length > 2) { unreadable = true; continue; }
      rows++;
      // This reference uses a trailing minus on deduction amounts. Ignore accumulation.
      if (values[0] < 0) deductionCents += Math.abs(cents(values[0]));
      else earningCents += cents(values[0]);
    }
  }
  if (!rows || unreadable) add("TABLE_UNREADABLE", "The payroll table could not be fully checked; review the original document.");
  if (rows && !unreadable && gross != null && deductions != null && (differs(earningCents / 100, gross) || differs(deductionCents / 100, deductions))) add("LINE_ITEMS_MISMATCH", "Current payment/deduction rows do not match the stated totals. Accumulation is excluded.");
  return { layout: "smart_zambia_reference", gross_salary: gross, total_deductions: deductions, net_salary: netPay, employee_number: identifiers?.[1] ?? null, nrc_number: identifiers?.[2].replace(/\s/g, "") ?? null, full_name: fullName, employer: "Government of the Republic of Zambia", pay_period: period, review_flags: flags };
}
