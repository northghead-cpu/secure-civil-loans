import type { PayrollParseResult } from "./payrollParsingService";
import type { PayslipReviewFlag } from "./smartZambiaPayslip";
import { parseOcrPayslipPeriod } from "./payslipPeriodValidationService";

export function reviewPayslip(result: PayrollParseResult, expected: { name?: string | null; nrc?: string | null; period?: string | null } = {}): PayslipReviewFlag[] {
  const flags = [...(result.review_flags ?? [])];
  if (!result.success) flags.push({ code: "OCR_FAILED", message: "The payslip could not be read. Review the original evidence." });
  if (result.layout !== "smart_zambia_reference") flags.push({ code: "UNRECOGNIZED_LAYOUT", message: "This document does not match the configured Smart Zambia reference. Review its format manually." });
  const name = (value: string) => value.toLocaleLowerCase().replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/, "").replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean).sort().join(" ");
  if (expected.name && result.full_name && name(expected.name) !== name(result.full_name)) flags.push({ code: "NAME_MISMATCH", message: "The extracted name differs from the submitted identity details." });
  if (expected.nrc && result.nrc_number && expected.nrc.replace(/\s/g, "") !== result.nrc_number.replace(/\s/g, "")) flags.push({ code: "NRC_MISMATCH", message: "The extracted NRC differs from the submitted identity details." });
  if (expected.period && parseOcrPayslipPeriod(result.pay_period)?.key !== expected.period.slice(0, 7)) flags.push({ code: "PERIOD_MISMATCH", message: "The extracted pay month differs from the recorded evidence period." });
  return flags;
}
