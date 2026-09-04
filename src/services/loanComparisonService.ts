/**
 * Borrower-facing repayment calculation.
 *
 * This preserves the calculation historically used by ComparePage. It is
 * intentionally separate from the reference-data Edge Function until the
 * platform establishes whether lender rates are amortizing or flat/simple.
 */
export const calculateMonthlyPayment = (
  principal: number,
  annualRate: number,
  months: number,
): number => {
  if (months <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;

  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
};
