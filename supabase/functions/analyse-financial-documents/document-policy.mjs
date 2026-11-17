// Pending sources are private previews only. Never send them to a lender.
export function selectFinancialDocuments(inventory, validatedOnly = false) {
  const candidates = inventory.filter((d) =>
    (validatedOnly ? d.validation_status === "VALID" :
      ["VALID", "PENDING"].includes(d.validation_status)));
  const seen = new Set();
  const payroll = candidates.filter((d) => d.document_type === "PAYSLIP")
    .sort((a,b) => String(b.pay_period).localeCompare(String(a.pay_period)) ||
      String(b.updated_at).localeCompare(String(a.updated_at)) || a.id.localeCompare(b.id))
    .filter((d) => {
      if (!d.pay_period || seen.has(d.pay_period)) return false;
      seen.add(d.pay_period); return true;
    }).slice(0,3);
  const bank = candidates.filter((d) => d.document_type === "BANK_STATEMENT")
    .sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)) ||
      a.id.localeCompare(b.id)).slice(0,3);
  return [...payroll,...bank];
}
export function markPreliminaryAnalysis(base, sources) {
  const pending = sources.filter((d) => d.validation_status !== "VALID").map((d) => d.id);
  return {
    ...base,
    documentReviewPending: pending.length > 0,
    pendingDocumentIds: pending,
    ...(pending.length ? {
      status: "review_required",
      issues: [...new Set([...base.issues, "DOCUMENT_REVIEW_PENDING"])],
    } : {}),
    notACreditDecision: true,
  };
}
