import { describe, expect, it } from "vitest";
import { calculateMonthlyPayment } from "../loanComparisonService";

describe("loan comparison repayment math", () => {
  it("preserves the current amortizing-payment calculation used by ComparePage", () => {
    expect(calculateMonthlyPayment(100000, 12, 12)).toBeCloseTo(8884.88, 2);
  });

  it("uses straight-line principal when the rate is zero", () => {
    expect(calculateMonthlyPayment(120000, 0, 12)).toBe(10000);
  });

  it("returns zero for an invalid term", () => {
    expect(calculateMonthlyPayment(120000, 12, 0)).toBe(0);
  });
});
