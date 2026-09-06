export interface LoanCalculationInput {
  principal: number;
  annualRate: number;
  termMonths: number;
  takeHomePay?: number | null;
  existingDeductions?: number | null;
}

export interface LoanCalculationResult {
  monthlyRepayment: number;
  totalRepayment: number;
  totalInterest: number;
  remainingIncome: number | null;
  repaymentToIncomePercent: number | null;
}

export const calculateMonthlyPayment = (principal: number, annualRate: number, termMonths: number): number => {
  if (!Number.isFinite(principal) || principal < 0) throw new Error("Principal must be a non-negative number");
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new Error("Annual rate must be a non-negative number");
  if (!Number.isInteger(termMonths) || termMonths <= 0) throw new Error("Term must be a positive whole number of months");
  if (principal === 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  const growth = Math.pow(1 + monthlyRate, termMonths);
  return principal * (monthlyRate * growth) / (growth - 1);
};

export const calculateLoan = (input: LoanCalculationInput): LoanCalculationResult => {
  const monthlyRepayment = calculateMonthlyPayment(input.principal, input.annualRate, input.termMonths);
  const totalRepayment = monthlyRepayment * input.termMonths;
  const totalInterest = Math.max(0, totalRepayment - input.principal);
  const takeHomePay = input.takeHomePay ?? null;
  const existingDeductions = input.existingDeductions ?? 0;
  const availableIncome = takeHomePay == null ? null : Math.max(0, takeHomePay - existingDeductions);
  return {
    monthlyRepayment,
    totalRepayment,
    totalInterest,
    remainingIncome: availableIncome == null ? null : availableIncome - monthlyRepayment,
    repaymentToIncomePercent: availableIncome == null || availableIncome <= 0 ? null : (monthlyRepayment / availableIncome) * 100,
  };
};
