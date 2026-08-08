import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

/**
 * Zambian civil-servant affordability rule: total monthly deductions for a
 * loan may not exceed one third of net salary.
 */
export default defineTool({
  name: "check_affordability",
  title: "Check loan affordability",
  description:
    "Check a loan against the Zambian one-third-of-net-salary affordability rule and return the estimated monthly repayment.",
  inputSchema: {
    net_salary: z.number().describe("Monthly net salary in ZMW."),
    amount: z.number().describe("Requested loan amount in ZMW."),
    term_months: z.number().int().describe("Repayment term in months."),
    annual_interest_rate: z
      .number()
      .optional()
      .describe("Annual interest rate as a percentage, e.g. 24 for 24%. Defaults to 24."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ net_salary, amount, term_months, annual_interest_rate }) => {
    if (net_salary <= 0 || amount <= 0 || term_months <= 0) {
      return {
        content: [{ type: "text", text: "net_salary, amount and term_months must all be greater than zero." }],
        isError: true,
      };
    }

    const annualRate = annual_interest_rate ?? 24;
    const monthlyRate = annualRate / 100 / 12;
    const monthlyRepayment =
      monthlyRate === 0
        ? amount / term_months
        : (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term_months));

    const maxAffordable = net_salary / 3;
    const affordable = monthlyRepayment <= maxAffordable;
    const round = (v: number) => Math.round(v * 100) / 100;

    const result = {
      monthly_repayment_zmw: round(monthlyRepayment),
      max_affordable_monthly_zmw: round(maxAffordable),
      affordable,
      rule: "Monthly repayment must not exceed one third of net salary.",
      annual_interest_rate: annualRate,
      term_months,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
