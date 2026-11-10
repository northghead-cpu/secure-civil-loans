import { describe, it, expect } from "vitest";
import { reviewPayslip } from "./payslipReviewService";
import type { PayrollParseResult } from "./payrollParsingService";

const parsed: PayrollParseResult = { layout: "smart_zambia_reference", full_name: "KALABA MWANSA", nrc_number: "987654/32/1", gross_salary: 12000, total_deductions: 3000, net_salary: 9000, employee_number: "00990001", employer: "Government of the Republic of Zambia", pay_period: "October 2026", review_flags: [], raw_text: "synthetic fixture", confidence: 94, success: true };
describe("payslip review comparisons", () => {
  it("allows reordered name tokens and titles while comparing NRC and month", () => {
    expect(reviewPayslip(parsed, { name: "Mr Mwansa Kalaba", nrc: "987654/32/1", period: "2026-10-01" })).toEqual([]);
  });
  it("flags identity and month differences without approving or rejecting a person", () => {
    expect(reviewPayslip(parsed, { name: "Other Person", nrc: "123456/78/1", period: "2026-09-01" }).map(f => f.code)).toEqual(["NAME_MISMATCH", "NRC_MISMATCH", "PERIOD_MISMATCH"]);
  });
  it("retains arithmetic warnings and never calls unknown/failed OCR clean", () => {
    expect(reviewPayslip({ ...parsed, success: false, layout: undefined, review_flags: [{ code: "TOTALS_MISMATCH", message: "Totals differ" }] }).map(f => f.code)).toEqual(["TOTALS_MISMATCH", "OCR_FAILED", "UNRECOGNIZED_LAYOUT"]);
  });
});
