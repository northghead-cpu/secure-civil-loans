# Riverbanc Capability Boundaries Design

**Date:** 2026-09-04
**Branch:** `systems-health-95pct`
**Baseline:** `5196c740e8c6866b8c976281c774ce11664b2171`

## Goal

Align the Riverbanc frontend and service architecture with the company's business philosophy without merging distinct business responsibilities or creating duplicate sources of truth.

## Business Principles

1. Riverbanc is a technology marketplace/comparison platform, not a bank or lender.
2. The applicant is the primary customer; the journey must remain clear from comparison through lender outcome.
3. Participating financial institutions own lending decisions and disbursement decisions.
4. Each business responsibility has one authoritative owner, while distinct actor-facing interfaces remain separate.
5. No duplicate source of truth is permitted for the same business object.
6. Consequential actions must remain auditable and appropriately role/tenant scoped.
7. The UI must never imply a capability that the backend cannot actually execute.
8. Sensitive applicant, KYC, lender and risk data must remain segregated according to role and access boundaries.
9. Automation may assist operations but must not silently replace accountable business decisions.
10. Existing working capabilities must be preserved; remediation must target verified gaps and architectural drift only.

## Capability Classification

Every discovered capability is classified as exactly one of:

- **A — Fully exposed:** backend capability and appropriate frontend surface are both present and correctly connected.
- **B — Backend exists, frontend missing:** executable capability has no appropriate frontend surface for its actor.
- **C — Frontend bypasses service:** frontend works but bypasses an existing authoritative service boundary.
- **D — Duplicate/competing implementation:** multiple implementations appear to own the same responsibility or data model.
- **E — Backend incomplete:** frontend exists but the underlying capability is not fully operational.
- **F — Intentionally non-UI:** system capability such as cron, internal RPC or external tool surface that should not be duplicated as conventional UI.

## Actor Boundaries

### Borrower

The borrower-facing product owns comparison, application progress, KYC interaction, notifications and payment receipts. It must clearly communicate that lenders make lending decisions.

### Operations/Admin

Operations owns application processing, underwriting operations, risk/compliance operations, product administration, payroll operations and lender handoff operations. These interfaces must not be exposed to ordinary borrowers.

### Lender/Partner

Lender-facing capabilities own diligence intake, applicant handoff, lender review and lender decision/status workflows. Riverbanc facilitates the handoff but does not become the lender.

### System

Cron jobs, internal RPCs, cache invalidation, security controls and MCP/external tool surfaces remain system capabilities unless a verified actor-facing requirement exists.

## Boundary Decisions

### Keep Separate

- Borrower Notification Centre vs Receipt Centre.
- Application Handoff Operations vs Borrower Application Status.
- Risk Operations vs Underwriting.
- Payroll Manager vs Product Management.
- Underwriting Reference vs CRB Reference.
- Product Management vs Loan Comparison UI.
- MCP tools vs conventional application UI.

These may share domain services/data contracts but represent different actors, responsibilities or trust boundaries.

### Consolidate at the Service/Data Boundary

- Product administration and comparison must converge on one authoritative product model and service contract. The UI responsibilities remain separate.
- Frontend consumers of risk data should use the existing `riskService` rather than direct table access where the service is authoritative.
- Payroll Manager should use `payrollService` for payroll integration lifecycle operations rather than maintaining a parallel data-access path.
- Reference-data consumers should use `referenceDataService` for catalogue/comparison/reference resources instead of duplicating calculations or direct table reads.

### Existing Capabilities Not to Rebuild

KYC, OCR/NRC/government-ID/payslip parsing, fraud pipeline, underwriting UI, CRB UI/proxy, lender-product comparison, application authorization, borrower application status, audit-log UI, data export and RBAC administration remain in place unless the boundary audit proves a concrete defect.

## Initial Verified Drift

The current branch contains an implemented `referenceDataService` exposing catalogue, comparison, underwriting-reference and CRB-reference resources, while `ComparePage` directly reads `bank_products` and performs comparison mathematics locally. The service therefore exists but is not the authoritative frontend path for that capability.

The codebase also contains `adminProductService` for CRUD on `products`, while the product-management UI path directly uses `bank_products`. This is a potential competing data model and must be resolved by evidence before any migration or deletion.

These findings are architectural drift, not permission to blindly merge interfaces.

## Implementation Strategy

1. Reconfirm the capability map against the exact current branch.
2. Establish authoritative ownership for each B/C/D/E finding.
3. Add or update tests before behavior changes.
4. Implement one bounded subsystem at a time.
5. Verify functional behavior, role boundaries, RLS/security assumptions and business-language implications after each subsystem.
6. Run full repository tests/build and deployment verification before declaring completion.
7. Re-audit the capability map after implementation to ensure no new duplicate path or actor-boundary violation was introduced.

## Success Criteria

- Every material backend capability is classified A-F with evidence.
- Distinct Riverbanc business responsibilities remain distinct in the UI.
- Shared business objects have one authoritative service/data path.
- Missing borrower, operations and lender surfaces are exposed only to their intended actors.
- No frontend feature claims Riverbanc itself lends, approves or disburses funds.
- No production capability is represented by mock or fabricated data.
- Automated tests, build, security checks and deployment verification support the final state.
