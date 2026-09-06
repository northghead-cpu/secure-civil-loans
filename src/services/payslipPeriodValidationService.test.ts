import { describe, expect, it } from "vitest";
import { getRequiredPayslipPeriods, parseOcrPayslipPeriod, validatePayslipPeriod, validatePayslipSet } from "./payslipPeriodValidationService";

const utc = (value: string) => new Date(`${value}T12:00:00.000Z`);

describe("payslip period validation", () => {
  it("derives June, July and August for September 6 2026", () => {
    expect(getRequiredPayslipPeriods(utc("2026-09-06")).map((p) => p.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("handles October and January year boundaries", () => {
    expect(getRequiredPayslipPeriods(utc("2026-10-20")).map((p) => p.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(getRequiredPayslipPeriods(utc("2027-01-02")).map((p) => p.key)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(getRequiredPayslipPeriods(utc("2027-01-31")).map((p) => p.key)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("handles leap years and month-end dates", () => {
    expect(getRequiredPayslipPeriods(utc("2024-03-01")).map((p) => p.key)).toEqual(["2023-12", "2024-01", "2024-02"]);
    expect(getRequiredPayslipPeriods(utc("2024-03-31")).map((p) => p.key)).toEqual(["2023-12", "2024-01", "2024-02"]);
  });

  it("rejects the current incomplete month, old months and future periods", () => {
    const date = utc("2026-09-06");
    expect(validatePayslipPeriod("September 2026", date).valid).toBe(false);
    expect(validatePayslipPeriod("May 2026", date).valid).toBe(false);
    expect(validatePayslipPeriod("October 2026", date).valid).toBe(false);
  });

  it("accepts only an OCR-established period and rejects ambiguous or missing periods", () => {
    expect(parseOcrPayslipPeriod("August 2026")?.key).toBe("2026-08");
    expect(parseOcrPayslipPeriod("August") ).toBeNull();
    expect(parseOcrPayslipPeriod("2026-08") ).toBeNull();
    expect(validatePayslipPeriod(null, utc("2026-09-06")).valid).toBe(false);
    expect(validatePayslipPeriod("August 2026", utc("2026-09-06"), 69).valid).toBe(false);
  });

  it("rejects duplicate months and requires the exact three-month set", () => {
    const date = utc("2026-09-06");
    expect(validatePayslipSet(["June 2026", "July 2026", "July 2026"], date).valid).toBe(false);
    expect(validatePayslipSet(["June 2026", "July 2026", "August 2026"], date).valid).toBe(true);
    expect(validatePayslipSet(["May 2026", "July 2026", "August 2026"], date).valid).toBe(false);
  });
});
