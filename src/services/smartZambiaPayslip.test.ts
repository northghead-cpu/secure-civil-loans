import { describe, it, expect } from "vitest";
import { parsePayrollAmount, parseSmartZambiaPayslip } from "./smartZambiaPayslip";

// Invented values and identities; structural reference only, no copied employee data.
export const referenceText = `SYNTHETIC REFERENCE ONLY - NOT A VALID PAYSLIP
GOVERNMENT OF THE REPUBLIC OF ZAMBIA
E-Payslip
PAY MONTH NEXT APPRAISAL PRESENT APPOINT
2026-10-31 01.01.2020 01.01.2019
EMPLOYEE NO. NRC TPIN SAL/SCALE
00990001 987654/32/1 0000000000 G Civil Servants
MR KALABA MWANSA  ZAMBIA NATIONAL COMMERCIAL BANK
Code Description Period Payment Amount Deduction Amount Accumulation
1000 Basic Salary 999 10.000,00 20.000,00
2024 Housing Allowance 999 2.000,00 4.000,00
/400 P.A.Y.E 999 2.000,00- 4.000,00-
E352 Bank Loan 012 1.000,00- 2.000,00-
Totals 12.000,00 3.000,00-
NET PAY 9.000,00`;

describe("Smart Zambia reference extraction and review checks", () => {
  it("reads decimal-comma/trailing-minus and decimal-point amounts exactly", () => {
    expect(parsePayrollAmount("10.553,46")).toBe(10553.46);
    expect(parsePayrollAmount("4.849,62-")).toBe(-4849.62);
    expect(parsePayrollAmount("10,553.46")).toBe(10553.46);
    expect(parsePayrollAmount("1 234,56")).toBe(1234.56);
    expect(parsePayrollAmount("10.55,346")).toBeNull();
  });
  it("extracts header-value rows, preserves leading zeros and excludes bank and accumulation", () => {
    const r = parseSmartZambiaPayslip(referenceText, 94)!;
    expect(r).toMatchObject({ employee_number: "00990001", nrc_number: "987654/32/1", full_name: "KALABA MWANSA", gross_salary: 12000, total_deductions: 3000, net_salary: 9000, pay_period: "October 2026", review_flags: [] });
  });
  it("flags altered net pay and altered current rows independently", () => {
    expect(parseSmartZambiaPayslip(referenceText.replace("NET PAY 9.000,00", "NET PAY 9.100,00"), 94)!.review_flags.map(f => f.code)).toContain("TOTALS_MISMATCH");
    expect(parseSmartZambiaPayslip(referenceText.replace("10.000,00 20.000,00", "11.000,00 20.000,00"), 94)!.review_flags.map(f => f.code)).toContain("LINE_ITEMS_MISMATCH");
  });
  it("does not flag accumulation-only changes as current-pay inconsistencies", () => {
    expect(parseSmartZambiaPayslip(referenceText.replace("20.000,00", "30.000,00"), 94)!.review_flags).toEqual([]);
  });
  it("requires review for unreadable, duplicate, missing, low-confidence and invalid-date evidence", () => {
    for (const text of [referenceText.replace("2026-10-31", "2026-02-31"), referenceText + "\nNET PAY 9.000,00", referenceText.replace("00990001 987654/32/1", "unreadable"), referenceText.replace("E352 Bank Loan 012 1.000,00- 2.000,00-", "E352 Bank Loan 012 unreadable")]) {
      expect(parseSmartZambiaPayslip(text, 94)!.review_flags.length).toBeGreaterThan(0);
    }
    expect(parseSmartZambiaPayslip(referenceText, 20)!.review_flags.map(f => f.code)).toContain("LOW_OCR_CONFIDENCE");
  });
  it("does not claim an unrelated layout matches the reference", () => {
    expect(parseSmartZambiaPayslip("Company: Example\nNet Pay: 9000", 94)).toBeNull();
  });
});
