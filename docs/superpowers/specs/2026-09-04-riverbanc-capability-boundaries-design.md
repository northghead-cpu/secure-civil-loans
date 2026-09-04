# Riverbanc Capability Boundaries Design

**Date:** 2026-09-04
**Branch:** `systems-health-95pct`
**Baseline:** current branch after the architecture documentation and repayment-boundary commits.

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
- `products` vs `bank_products`: these are currently distinct domain models and must **not** be merged.

These may share appropriate infrastructure or service conventions but represent different actors, responsibilities, data semantics or trust boundaries.

### Consolidate at the Service/Data Boundary

- Frontend consumers of risk data should use the existing `riskService` where that service is authoritative.
- Payroll Manager should use `payrollService` for payroll integration lifecycle operations rather than maintaining a parallel data-access path.
- Reference-data consumers should use `referenceDataService` only where its response semantics are proven equivalent to the current frontend behavior.
- Product administration and lender-offer comparison must **not** be consolidated merely because both contain the word product. They use different models and responsibilities. Any shared abstractions must preserve that distinction.

## Important Financial-Logic Guardrail

The current `reference-data` comparison endpoint calculates repayment using a simple-interest formula, while the current `ComparePage` calculates an amortizing-payment formula. The catalogue endpoint also does not expose `product_type`, which the comparison UI currently requires. Therefore the comparison service is **not yet safe to designate as the authoritative replacement** for the current comparison path.

The repayment calculation has been isolated behind `loanComparisonService` and protected by regression tests without changing borrower-facing behavior. The next comparison work must establish the intended lender pricing semantics and response contract before changing the calculation or data source.

This is a deliberate business-protection rule: Riverbanc must not alter displayed repayment figures merely to achieve architectural consolidation.

## Verified Product-Model Finding

The repository defines `public.products` as a generic Product Management table with `name`, `description`, `pricing`, `status` and creator/audit metadata. Its policies are oriented toward super-admin management and admin visibility. fileciteturn56file0

Separately, `public.bank_products` is the lender-offer model used for loan comparison, with lender name, interest rate, amount limits, term limits, processing days and active status. It is explicitly created as part of the loan workflow. fileciteturn57file0

Therefore the earlier hypothesis that these are necessarily duplicate product implementations is **rejected**. They have materially different schemas and business purposes. `adminProductService` correctly targets the generic `products` model. The actual defect found there is narrower: it currently invalidates reference-data cache after writes to `products`, despite the reference-data comparison/catalogue path operating on lender `bank_products`. That coupling is semantically suspect and should be removed or proven necessary before further work.

## Initial Verified Drift

1. `ComparePage` historically contained the borrower repayment calculation inline. It is now isolated behind `loanComparisonService` without changing its formula. fileciteturn50file0
2. `referenceDataService` exposes catalogue, comparison, underwriting-reference and CRB-reference resources, but its comparison response is not yet semantically equivalent to the borrower calculation. fileciteturn48file0
3. `adminProductService` operates on generic `products`, not lender `bank_products`. Its cache invalidation call is the remaining coupling requiring review. fileciteturn58file0
4. Lender-offer comparison operates on `bank_products`; this is the correct domain model for participating financial-institution offers and should remain distinct from generic product administration. fileciteturn57file0

## Implementation Strategy

1. Reconfirm the capability map against the exact current branch.
2. Establish authoritative ownership for each B/C/D/E finding.
3. Treat financial calculations and product schemas as correctness boundaries, not ordinary refactors.
4. Add or update tests before behavior changes.
5. Implement one bounded subsystem at a time.
6. Verify functional behavior, role boundaries, RLS/security assumptions and business-language implications after each subsystem.
7. Run full repository tests/build and deployment verification before declaring completion.
8. Re-audit the capability map after implementation to ensure no new duplicate path or actor-boundary violation was introduced.

## Success Criteria

- Every material backend capability is classified A-F with evidence.
- Distinct Riverbanc business responsibilities remain distinct in the UI.
- Shared business objects have one authoritative service/data path where equivalence is proven.
- Missing borrower, operations and lender surfaces are exposed only to their intended actors.
- No borrower UI implies Riverbanc itself lends, approves or disburses funds.
- No production capability is represented by mock or fabricated data.
- Repayment figures and lender product semantics are not changed by refactoring unless the business rule is explicitly established and tested.
- Automated tests, build, security checks and deployment verification support the final state.
