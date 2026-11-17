import assert from "node:assert/strict";
import { analyseDocuments, parsePayslip, parseBankStatement } from "./analysis.mjs";
const text = (month) =>
  "GOVERNMENT E-Payslip PAY MONTH NEXT APPRAISAL PRESENT APPOINT " +
  month +
  "-31 EMPLOYEE NO. NRC 00998877 000000/00/0 /400 P.A.Y.E 999 1,000.00- 9,000.00- /330 NAPSA EE contr. 999 500.00- 4,500.00- E095 Bayport 004 600.00- 5,400.00- F427 Optimum Instant Loan 009 400.00- 3,600.00- Totals 8,000.00 2,500.00- NET PAY 5,500.00";
const bank =
  "Zanaco Statement of Account 998877 GRZSalary Oct 23, 2026 Oct 23, 2026 Direct Debit Transaction OPONE:Borrower : UNITY FINANCE L : LOAN-A : REF 300.00 -300.00 Oct 23, 2026 Oct 23, 2026 Direct Debit Transaction OPTWO:Borrower : OPTIMUM FINANCIAL SERVICES : LOAN-B : REF 200.00 -500.00 Oct 23, 2026 Oct 23, 2026 Unpaid EFT Debit Transaction OUONE:(013) : Borrower : UNITY FINANCE L : LOAN-A : REF 300.00 -200.00";
assert.equal(parsePayslip(text("2026-10"), "2026-10-01", "00998877").payrollDebt, 1000);
assert.deepEqual(parsePayslip(text("2026-10"), "2026-10-01", "00998877").issues, []);
assert.ok(
  parsePayslip(text("2026-10"), "2026-09-01", "00998877").issues.includes("PAY_PERIOD_MISMATCH"),
);
assert.ok(
  parsePayslip(text("2026-10"), "2026-10-01", "12345").issues.includes("EMPLOYEE_ID_NOT_MATCHED"),
);
assert.ok(
  parsePayslip(
    text("2026-10").replace("5,500.00", "5,400.00"),
    "2026-10-01",
    "00998877",
  ).issues.includes("PAYSLIP_TOTALS_DO_NOT_BALANCE"),
);
const docs = ["08", "09", "10"].map((m) => ({
  id: m,
  type: "PAYSLIP",
  period: "2026-" + m + "-01",
  text: text("2026-" + m),
}));
docs.push({ id: "bank", type: "BANK_STATEMENT", text: bank });
const result = analyseDocuments(docs, "00998877", 1200);
assert.equal(result.gross, 8000);
assert.equal(result.net, 5500);
assert.equal(result.bankSummary.attemptedDebt, 500);
assert.equal(result.bankSummary.unpaidReversals, 300);
assert.equal(result.externalDebtLowerBound, 300);
assert.equal(result.documentDebtRatioPercent, 31.25);
assert.equal(result.estimatedMonthlyExpenses, null);
assert.ok(result.issues.includes("POSSIBLE_PAYROLL_BANK_DEBT_OVERLAP"));
assert.ok(result.issues.includes("UNPAID_DEBITS_REQUIRE_CURRENT_BALANCE_CHECK"));
assert.equal(
  analyseDocuments([...docs, docs.at(-1)], "00998877", 1200).bankSummary.attemptedDebt,
  500,
);
assert.equal(
  analyseDocuments([{ type: "PAYSLIP", text: "scanned page", period: "2026-10" }], "00998877", 1200)
    .gross,
  null,
);
assert.equal(parseBankStatement("different bank template").rows.length, 0);
assert.ok(analyseDocuments(docs, "4444", 1200).issues.includes("BANK_EMPLOYEE_NOT_MATCHED"));
assert.equal(result.notACreditDecision, true);
console.log(
  "PASS 18 automated financial extraction, overlap, reversals, identity and missing-data assertions",
);

const { readPayrollLayout } = await import("./analysis.mjs");
const item = (str, x, y, width = 50) => ({ str, transform: [1, 0, 0, 1, x, y], width });
const layout = await readPayrollLayout({
  numPages: 1,
  getPage: async () => ({
    getViewport: () => ({ width: 600 }),
    getTextContent: async () => ({
      items: [
        item("E095", 10, 100),
        item("600.00-", 400, 100),
        item("5,400.00-", 500, 100),
        item("/330", 10, 80),
        item("500.00-", 400, 80),
        item("4,500.00-", 500, 80),
        item("/410", 10, 60),
        item("15.00-", 500, 60),
      ],
    }),
  }),
});
assert.equal(layout.find((r) => r.code === "/410").amount, 0);
assert.equal(layout.find((r) => r.code === "/410").accumulationOnly, true);
assert.equal(layout.find((r) => r.code === "E095").amount, 600);
console.log("PASS accumulation-only payroll amounts do not become monthly deductions");

const inbound = parseBankStatement(
  "Zanaco Statement of Account Oct 01, 2026 DIGITAL NFS TRANSACTIONS GROCERY REF C 100.00 100.00",
);
assert.equal(inbound.rows[0].kind, "income");
assert.equal(inbound.rows[0].livingExpense, false);
console.log("PASS incoming credits are never classified as living-cost payments");
