import { describe, expect, it } from "vitest";
import { calculateLoan, calculateMonthlyPayment } from "./loanCalculationService";

describe("loan calculation service", () => {
  it("calculates amortizing repayments", () => {
    expect(calculateMonthlyPayment(100000, 12, 12)).toBeCloseTo(8884.88, 2);
  });
  it("handles zero interest without changing the principal", () => {
    expect(calculateMonthlyPayment(120000, 0, 12)).toBe(10000);
  });
  it("returns total interest and remaining income from real supplied inputs", () => {
    const result = calculateLoan({ principal: 100000, annualRate: 12, termMonths: 12, takeHomePay: 30000, existingDeductions: 5000 });
    expect(result.totalRepayment).toBeCloseTo(106618.5464, 2);
    expect(result.totalInterest).toBeCloseTo(6618.5464, 2);
    expect(result.remainingIncome).toBeCloseTo(16115.1211, 2);
    expect(result.repaymentToIncomePercent).toBeCloseTo(35.5395, 3);
  });
  it("rejects invalid terms and rates", () => {
    expect(() => calculateMonthlyPayment(100000, -1, 12)).toThrow();
    expect(() => calculateMonthlyPayment(100000, 12, 0)).toThrow();
  });
});
