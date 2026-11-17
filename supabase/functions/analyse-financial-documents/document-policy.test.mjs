import assert from "node:assert/strict";
import {
  selectFinancialDocuments,
  markPreliminaryAnalysis,
} from "./document-policy.mjs";
const valid = {
  id: "v",
  document_type: "PAYSLIP",
  pay_period: "2026-10-01",
  updated_at: "2026-11-01",
  validation_status: "VALID",
};
const pending = {
  ...valid,
  id: "p",
  updated_at: "2026-11-02",
  validation_status: "PENDING",
};
const rejected = {
  ...pending,
  id: "r",
  updated_at: "2026-11-03",
  validation_status: "REJECTED",
};
const bank = {
  id: "b",
  document_type: "BANK_STATEMENT",
  updated_at: "2026-11-02",
  validation_status: "PENDING",
};
const input = [valid, pending, rejected, bank];
assert.deepEqual(
  selectFinancialDocuments(input).map((d) => d.id),
  ["p", "b"],
);
assert.deepEqual(
  selectFinancialDocuments(input, true).map((d) => d.id),
  ["v"],
);
const base = { gross: 10000, status: "review_required", issues: [] };
const preview = markPreliminaryAnalysis(base, selectFinancialDocuments(input));
assert.equal(preview.documentReviewPending, true);
assert.equal(preview.notACreditDecision, true);
assert.equal(preview.gross, 10000);
assert.ok(preview.issues.includes("DOCUMENT_REVIEW_PENDING"));
assert.deepEqual(preview.pendingDocumentIds, ["p", "b"]);
assert.equal(
  markPreliminaryAnalysis(base, [valid]).documentReviewPending,
  false,
);
assert.equal(valid.validation_status, "VALID");
assert.equal(pending.validation_status, "PENDING");
assert.deepEqual(
  selectFinancialDocuments([
    { ...valid, id: "z" },
    { ...valid, id: "a" },
  ]).map((d) => d.id),
  ["a"],
);
console.log(
  "PASS document policy: pending private preview, validated lender sources, rejected exclusion, deterministic periods, no approval",
);
