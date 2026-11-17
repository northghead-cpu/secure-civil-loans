const money = /-?(?:\d{1,3}(?:,\d{3})+|\d*)\.\d{2}(?!\d)/g;
const amount = (s) => Math.abs(Number(String(s).replaceAll(",", "").replace(/-$/, "")));
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const flat = (s) => String(s).replace(/\s+/g, " ").trim();
const key = (s) => {
  const aliases = [
    "unity",
    "kuntem",
    "bsquare",
    "optimum",
    "tottengram",
    "fillsplash",
    "firmstone",
    "izwe",
    "lawrence",
    "bayport",
    "creditcare",
    "leadpoint",
    "yescash",
    "dalikas",
    "fmc",
    "minutoes",
    "fiel",
    "lumo",
    "afrobiz",
    "ekas",
    "gemz",
    "kooloka",
    "brex",
    "rukeys",
    "ich esu",
    "climate",
    "milena",
  ];
  const v = s.toLowerCase().replace(/[^a-z]/g, "");
  return aliases.find((a) => v.includes(a.replaceAll(" ", ""))) ?? v;
};
const statutory =
  /p\.?\s*a\.?\s*y\.?\s*e|napsa|personal levy|national health|funeral ins|pension|teachers unio/i;
const credit =
  /financial|finance|fin\.|loan|credit|bayport|yescash|dime|dalikas|fmc|lumo|afrobiz|transparent|ekas|gemz|kooloka|brex|tottengram|rukeys|ich esu|ichesu|fiel capital|firm.?stone|milena/i;
export function parsePayslip(text, expectedPeriod, employeeNumber, layout = null) {
  const t = flat(text);
  const period = t.match(/PAY MONTH.{0,180}?(20\d{2}-\d{2}-\d{2})/i)?.[1]?.slice(0, 7);
  const issues = [];
  if (!period || period !== expectedPeriod?.slice(0, 7)) issues.push("PAY_PERIOD_MISMATCH");
  if (
    !employeeNumber ||
    !new RegExp("\\b" + String(employeeNumber).replace(/^0+/, "0*") + "\\b").test(t.slice(0, 1800))
  )
    issues.push("EMPLOYEE_ID_NOT_MATCHED");
  const totals = t.match(
    /Totals\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})-?\s+NET\s+PAY\s+([\d,]+\.\d{2})/i,
  );
  if (!totals) return { period, issues: [...issues, "PAYSLIP_TOTALS_NOT_READABLE"], rows: [] };
  const [gross, deductions, net] = totals.slice(1).map(amount);
  if (Math.abs(gross - deductions - net) > 0.03) issues.push("PAYSLIP_TOTALS_DO_NOT_BALANCE");
  const area = t.slice(0, totals.index);
  const positions = [...area.matchAll(/(?:^|\s)(\/\d{3}|[EF]\d{3})(?=\s)/g)];
  const rows = [];
  for (let i = 0; i < positions.length; i++) {
    const match = positions[i],
      block = area.slice(match.index + match[0].length, positions[i + 1]?.index ?? area.length);
    const m = [...block.matchAll(money)][0];
    if (!m) {
      issues.push("PAYROLL_ROW_UNREADABLE");
      continue;
    }
    const description = block
      .slice(0, m.index)
      .replace(/\s+\d{3}\s*$/, "")
      .trim();
    const category = statutory.test(description)
      ? "non_debt"
      : credit.test(description)
        ? "debt"
        : "unclassified";
    rows.push({
      code: match[1],
      description,
      amount: layout?.find((r) => r.code === match[1])?.amount ?? amount(m[0]),
      category,
      creditor: key(description),
    });
  }
  const sum = round(rows.reduce((s, r) => s + r.amount, 0));
  if (Math.abs(sum - deductions) > 0.05) issues.push("PAYROLL_ROWS_DO_NOT_RECONCILE");
  if (rows.some((r) => r.category === "unclassified"))
    issues.push("PAYROLL_DEDUCTIONS_NEED_CLASSIFICATION");
  return {
    period,
    gross,
    deductions,
    net,
    rows,
    issues,
    payrollDebt: round(rows.filter((r) => r.category === "debt").reduce((s, r) => s + r.amount, 0)),
  };
}
const marker =
  /Unpaid EFT Debit Transaction|EFT Direct Credit Transaction|Direct Debit Transaction|COMMISSION ON DIGITAL NFS TRANSACTIONS|DIGITAL NFS TRANSACTIONS|ACCOUNT MAINTENANCE|POS PURCHASE|CARD PURCHASE|ATM WITHDRAWAL/gi;
const datePattern =
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+20\d{2}\b/gi;
const monthNumber = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};
export function parseBankStatement(text) {
  const t = flat(text),
    positions = [...t.matchAll(marker)],
    rows = [],
    issues = [];
  if (!/Zanaco Statement of Account/i.test(t))
    return { rows, issues: ["BANK_TEMPLATE_NOT_SUPPORTED"] };
  for (let i = 0; i < positions.length; i++) {
    const m = positions[i],
      block = t.slice(m.index + m[0].length, positions[i + 1]?.index ?? t.length);
    const nums = [...block.matchAll(money)];
    const dates = [...t.slice(Math.max(0, m.index - 180), m.index).matchAll(datePattern)];
    const d = dates.at(-1)?.[0]?.match(/([A-Za-z]+)\s+(\d+),?\s+(20\d{2})/);
    if (nums.length < 2 || !d) {
      issues.push("BANK_ROW_UNREADABLE");
      continue;
    }
    const period = d[3] + "-" + monthNumber[d[1]],
      date = period + "-" + d[2].padStart(2, "0");
    let kind = /^Unpaid/i.test(m[0])
      ? "reversal"
      : /^Direct Debit/i.test(m[0])
        ? "debt"
        : /^EFT Direct Credit/i.test(m[0])
          ? "income"
          : /^COMMISSION|^ACCOUNT/i.test(m[0])
            ? "bank_fee"
            : "spending";
    const parts = block.split(":").map((s) => s.trim());
    const creditor = kind === "reversal" ? parts[3] : parts[2];
    const narrative = block.slice(0, nums[0].index);
    const direction = block.slice(0, nums[0].index).match(/\b([DC])\s*$/)?.[1];
    if (kind === "spending" && direction === "C") kind = "income";
    const living =
      kind === "spending" &&
      /grocery|supermarket|shoprite|pick.n.pay|rent payment|electricity|water bill|school fee|medical|pharmacy/i.test(
        narrative,
      );
    rows.push({
      date,
      period,
      kind,
      amount: amount(nums[0][0]),
      creditor: creditor ? key(creditor) : null,
      livingExpense: living,
      reference: parts[0]?.trim().slice(0, 100),
    });
  }
  if (!rows.length) issues.push("BANK_TRANSACTIONS_NOT_READABLE");
  return { rows, issues };
}
export function analyseDocuments(documents, employeeNumber, proposedInstalment = null) {
  const payslips = documents
    .filter((d) => d.type === "PAYSLIP")
    .map((d) => ({
      ...parsePayslip(d.text, d.period, employeeNumber, d.layout),
      documentId: d.id,
      sha256: d.sha256,
    }));
  const valid = payslips.filter(
    (p) =>
      p.net > 0 &&
      !p.issues.some((s) =>
        [
          "PAY_PERIOD_MISMATCH",
          "EMPLOYEE_ID_NOT_MATCHED",
          "PAYSLIP_TOTALS_DO_NOT_BALANCE",
          "PAYSLIP_TOTALS_NOT_READABLE",
          "PAYROLL_ROWS_DO_NOT_RECONCILE",
        ].includes(s),
      ),
  );
  valid.sort((a, b) => b.period.localeCompare(a.period));
  const latest = valid[0],
    bankDocuments = documents.filter((d) => d.type === "BANK_STATEMENT");
  const bank = bankDocuments.map((d) => {
    const parsed = parseBankStatement(d.text);
    if (
      !employeeNumber ||
      !new RegExp("\\b" + String(employeeNumber).replace(/^0+/, "0*") + "\\b").test(flat(d.text))
    ) {
      parsed.rows = [];
      parsed.issues.push("BANK_EMPLOYEE_NOT_MATCHED");
    }
    return { ...parsed, documentId: d.id, sha256: d.sha256 };
  });
  const unique = new Map();
  for (const b of bank)
    for (const row of b.rows)
      unique.set([row.date, row.reference, row.kind, row.amount].join("|"), row);
  const rows = [...unique.values()],
    period = latest?.period;
  const month = rows.filter((r) => r.period === period),
    debt = month.filter((r) => r.kind === "debt"),
    reversals = month.filter((r) => r.kind === "reversal");
  const payrollCreditors = new Set(
    (latest?.rows ?? []).filter((r) => r.category === "debt").map((r) => r.creditor),
  );
  const overlap = debt.filter((r) => payrollCreditors.has(r.creditor));
  const external = debt.filter((r) => !payrollCreditors.has(r.creditor));
  const issues = [...payslips.flatMap((p) => p.issues), ...bank.flatMap((b) => b.issues)];
  if (new Set(valid.map((p) => p.period)).size < 3)
    issues.push("THREE_READABLE_PAYSLIP_MONTHS_REQUIRED");
  if (!bank.length) issues.push("BANK_STATEMENT_REQUIRED");
  if (overlap.length) issues.push("POSSIBLE_PAYROLL_BANK_DEBT_OVERLAP");
  if (reversals.length) issues.push("UNPAID_DEBITS_REQUIRE_CURRENT_BALANCE_CHECK");
  if (month.some((r) => r.kind === "spending" && !r.livingExpense))
    issues.push("UNCLASSIFIED_TRANSFERS_OR_CASH");
  const dated = rows.map((r) => new Date(r.date + "T00:00:00Z").getTime()).filter(Number.isFinite);
  const days = dated.length ? (Math.max(...dated) - Math.min(...dated)) / 86400000 + 1 : 0;
  const knownSpending = rows.filter((r) => r.livingExpense);
  const completeExpenseWindow =
    days >= 28 &&
    knownSpending.length > 0 &&
    !rows.some((r) => r.kind === "spending" && !r.livingExpense);
  const expenseEstimate = completeExpenseWindow
    ? round((knownSpending.reduce((s, r) => s + r.amount, 0) / days) * 30)
    : null;
  issues.push(
    completeExpenseWindow
      ? "LIVING_EXPENSES_ESTIMATED_FROM_BANK_ACTIVITY"
      : "MONTHLY_LIVING_EXPENSES_NOT_FULLY_ESTABLISHED",
  );
  const payrollDebt = latest?.payrollDebt ?? null;
  const externalDebtLowerBound = external.length
    ? round(external.reduce((s, r) => s + r.amount, 0))
    : null;
  const observedLivingExpenses = round(
    month.filter((r) => r.livingExpense).reduce((s, r) => s + r.amount, 0),
  );
  const documentDebtRatio =
    latest && externalDebtLowerBound !== null && proposedInstalment > 0
      ? round(((payrollDebt + externalDebtLowerBound + proposedInstalment) / latest.gross) * 100)
      : null;
  const checks = [
    !!latest,
    valid.length >= 3,
    bank.length > 0,
    bank.some((b) => b.rows.length > 0),
    !!latest && !latest.issues.includes("PAYROLL_ROWS_DO_NOT_RECONCILE"),
    !overlap.length,
    !reversals.length,
    !month.some((r) => r.kind === "spending" && !r.livingExpense),
  ];
  return {
    version: 1,
    status: issues.length ? "review_required" : "extracted",
    period,
    gross: latest?.gross ?? null,
    net: latest?.net ?? null,
    payrollDebt,
    externalDebtLowerBound,
    observedLivingExpenses,
    estimatedMonthlyExpenses: expenseEstimate,
    documentDebtRatioPercent: documentDebtRatio,
    dtiBasis: "gross_document_ratio_not_lender_confirmed",
    extractionQualityPercent: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    issues: [...new Set(issues)],
    payslips,
    bank,
    bankSummary: {
      attemptedDebt: round(debt.reduce((s, r) => s + r.amount, 0)),
      unpaidReversals: round(reversals.reduce((s, r) => s + r.amount, 0)),
      possibleOverlap: overlap.length,
    },
    notACreditDecision: true,
  };
}

export async function readPayrollLayout(pdf) {
  const rows = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo),
      content = await page.getTextContent(),
      width = page.getViewport({ scale: 1 }).width,
      lines = [];
    for (const item of content.items) {
      if (
        typeof item.str !== "string" ||
        !Array.isArray(item.transform) ||
        typeof item.width !== "number"
      )
        continue;
      const y = item.transform[5],
        line = lines.find((l) => Math.abs(l.y - y) < 1.5);
      if (line) line.items.push(item);
      else lines.push({ y, items: [item] });
    }
    for (const line of lines) {
      const items = line.items.sort((a, b) => a.transform[4] - b.transform[4]);
      const code = items
        .map((i) => i.str.trim().match(/^(\/\d{3}|[EF]\d{3})(?:\s|$)/)?.[1])
        .find(Boolean);
      if (!code) continue;
      const values = items
        .filter((i) => /^-?[\d,]*\.\d{2}-?$/.test(i.str.trim()))
        .map((i) => ({ text: i.str.trim(), right: (i.transform[4] + i.width) / width }));
      if (values.length) rows.push({ code, values });
    }
  }
  const candidates = rows
    .filter((r) => r.values.length >= 2)
    .map((r) => Math.min(...r.values.map((v) => v.right)))
    .sort((a, b) => a - b);
  if (candidates.length < 2) return null;
  const currentColumn = candidates[Math.floor(candidates.length / 2)];
  return rows.map((r) => {
    const v =
      r.values.length >= 2
        ? r.values[0]
        : r.values.find((v) => Math.abs(v.right - currentColumn) < 0.012);
    return { code: r.code, amount: v ? amount(v.text) : 0, accumulationOnly: !v };
  });
}
