import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { calculateLoan } from "@/services/loanCalculationService";

interface OfferCalculatorProps {
  amount: number;
  rate: number;
  termMonths: number;
  takeHomePay?: number | null;
  existingDeductions?: number | null;
}

const money = (value: number | null) => value == null ? "—" : `K${Math.round(value).toLocaleString()}`;

export default function OfferCalculator({ amount, rate, termMonths, takeHomePay, existingDeductions }: OfferCalculatorProps) {
  const result = useMemo(() => calculateLoan({ principal: amount, annualRate: rate, termMonths, takeHomePay, existingDeductions }), [amount, rate, termMonths, takeHomePay, existingDeductions]);
  const affordability = result.repaymentToIncomePercent;

  return (
    <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Repayment calculator</p>
          <p className="text-xs text-muted-foreground">Calculated from this lender's published product rate and term.</p>
        </div>
        {affordability != null && <Badge variant="outline">{affordability.toFixed(1)}% of available income</Badge>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Requested</p><p className="font-semibold">{money(amount)}</p></div>
        <div><p className="text-xs text-muted-foreground">Rate</p><p className="font-semibold">{rate}% p.a.</p></div>
        <div><p className="text-xs text-muted-foreground">Monthly</p><p className="font-semibold">{money(result.monthlyRepayment)}</p></div>
        <div><p className="text-xs text-muted-foreground">Term</p><p className="font-semibold">{termMonths} months</p></div>
        <div><p className="text-xs text-muted-foreground">Total interest</p><p className="font-semibold">{money(result.totalInterest)}</p></div>
        <div><p className="text-xs text-muted-foreground">Total repayment</p><p className="font-semibold">{money(result.totalRepayment)}</p></div>
        <div><p className="text-xs text-muted-foreground">Take-home pay</p><p className="font-semibold">{money(takeHomePay ?? null)}</p></div>
        <div><p className="text-xs text-muted-foreground">Remaining income</p><p className="font-semibold">{money(result.remainingIncome)}</p></div>
      </div>
      <Input aria-label="Calculated repayment" value={money(result.monthlyRepayment)} readOnly className="sr-only" />
      <p className="mt-3 text-xs text-muted-foreground">Existing deductions: {money(existingDeductions ?? null)}. This calculator is decision support only; the lender makes the lending decision.</p>
    </div>
  );
}
