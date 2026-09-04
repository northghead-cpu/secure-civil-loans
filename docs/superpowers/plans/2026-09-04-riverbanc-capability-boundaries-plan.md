# Riverbanc Capability Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and then harden Riverbanc capability boundaries so distinct business responsibilities stay separate while duplicate service/data paths are consolidated safely.

**Architecture:** First establish a factual A-F capability map against the exact `systems-health-95pct` branch. Then remediate one bounded subsystem at a time, beginning with lender/application handoff operations, while preserving the borrower status flow. Product, risk, payroll and reference-data consolidation are treated as separate bounded workstreams and are not merged into the handoff UI.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Supabase Postgres/Auth/Edge Functions, Tailwind/shadcn, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-04-riverbanc-capability-boundaries-design.md`

## Global Constraints

- Riverbanc remains a technology marketplace/comparison platform, not a lender.
- Participating financial institutions remain responsible for lending decisions and disbursement decisions.
- Borrower, operations/admin and lender/partner responsibilities remain separate frontend surfaces.
- One business responsibility must have one authoritative service/data owner.
- No production mock or fabricated data.
- Consequential actions remain auditable and role/tenant scoped.
- KYC, OCR, fraud, underwriting, CRB UI/proxy, application authorization, borrower status, audit-log, export and RBAC capabilities are not rebuilt unless a concrete defect is verified.
- No Lovable credits or regeneration; modify the existing repository only.
- TDD applies to behavior changes: write a failing test, verify the failure, implement the minimum change, verify green, then refactor.
- Do not claim completion until tests, build, security/data-access checks and deployment verification have been run.

---

### Task 1: Reconfirm the Exact Branch Baseline and Capability Inventory

**Files:**
- Read: `src/services/**/*.ts`
- Read: `src/pages/**/*.tsx`
- Read: `src/components/**/*.tsx`
- Read: `supabase/functions/**`
- Read: `supabase/migrations/**`
- Read: `docs/**`
- Read: `package.json`

**Interfaces:**
- Consumes: branch `systems-health-95pct` at the current head.
- Produces: an evidence-backed A-F capability matrix and an actor ownership map; no behavior changes.

- [ ] **Step 1: Verify the branch head and current CI state**
- [ ] **Step 2: Inventory frontend routes and components**
- [ ] **Step 3: Inventory services and Edge Functions**
- [ ] **Step 4: Inventory database/RPC ownership**
- [ ] **Step 5: Classify each capability A-F**
- [ ] **Step 6: Write the verified matrix to the architecture documentation**
- [ ] **Step 7: Commit the audit documentation**

---

### Task 2: Define the Application Handoff Operations Boundary

**Files:**
- Read: existing handoff UI and lifecycle migrations.
- Create/Modify: `src/services/applicationHandoffService.ts`, `src/pages/admin/ApplicationHandoffOperations.tsx`, admin route/navigation, and the lender-status protection migration.
- Test: `src/services/__tests__/applicationHandoffService.test.ts`.

**Interfaces:**
- Consumes: existing `application_handoffs` lifecycle and authorization RPC.
- Produces: an operations-facing handoff workflow that can coordinate Riverbanc-owned stages while preserving lender ownership of review, approval, decline and disbursement.

- [x] **Step 1: Write failing tests for actor separation and lifecycle semantics.**
- [x] **Step 2: Implement the minimum service boundary.**
- [x] **Step 3: Implement the operations surface and route/navigation.**
- [x] **Step 4: Enforce forward-only Riverbanc operational stages in the service.**
- [x] **Step 5: Protect lender-controlled status changes at the database trigger boundary.**
- [x] **Step 6: Add audit coverage for consequential operational status changes.**
- [ ] **Step 7: Run targeted tests and verify GREEN through CI/build gates.**

**Business guardrail:** Operations can coordinate `authorized → preparing → sent_to_lender`; lender-controlled states are displayed but cannot be manually manufactured by authenticated Riverbanc operators.

---

### Task 3: Borrower Notification Centre

**Files:**
- Read: existing `NotificationCenter` and notification generation code.
- Modify: borrower application status surface only where necessary to mount the existing component.
- Test: notification navigation/rendering tests.

**Interfaces:**
- Consumes: existing borrower notification types and `notificationForApplicationStatus()`.
- Produces: an actually mounted borrower notification surface without introducing a second notification model.

- [x] **Step 1: Mount the existing NotificationCenter on the borrower application-status surface.**
- [x] **Step 2: Map lender/application milestones to the existing notification generator.**
- [ ] **Step 3: Add dedicated regression tests for notification rendering/navigation.**
- [ ] **Step 4: Run targeted tests and verify GREEN.**

---

### Task 4: Borrower Receipt Centre

**Files:**
- Read: receipt generation/retrieval implementation and monthly billing cron.
- Create/Modify: borrower receipt page/components/service only where no existing equivalent exists.
- Test: receipt ownership, empty state, listing and download/access behavior.

**Interfaces:**
- Consumes: existing receipt records and user-scoped receipt retrieval.
- Produces: borrower-visible receipt history without changing monthly generation or billing logic.

- [ ] **Step 1: Write failing tests proving receipt visibility is user-scoped.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement the receipt centre against the existing receipt backend.**
- [ ] **Step 4: Verify no cross-account receipt access is possible through the UI path.**
- [ ] **Step 5: Run targeted tests and verify GREEN.**
- [ ] **Step 6: Commit.**

---

### Task 5: Reference-Data Boundary Consolidation Without Financial-Logic Drift

**Files:**
- Modify: `src/pages/ComparePage.tsx`
- Read/Modify: `src/services/referenceDataService.ts`
- Read: `supabase/functions/reference-data/**`
- Test: comparison/reference-data service tests.

**Interfaces:**
- Consumes: `referenceDataService.getCatalogue()` for the lender-offer catalogue.
- Produces: comparison UI backed by the authoritative reference-data catalogue path while preserving the existing borrower repayment calculation until pricing semantics are formally established.

- [x] **Step 1: Establish the mismatch between the reference comparison formula and borrower-facing formula.**
- [x] **Step 2: Preserve the amortizing borrower calculation behind `loanComparisonService`.**
- [x] **Step 3: Add `product_type` to the cached reference catalogue contract.**
- [x] **Step 4: Move ComparePage lender-product reads to `referenceDataService.getCatalogue()`.**
- [ ] **Step 5: Add regression tests for catalogue contract and borrower-facing comparison output.**
- [ ] **Step 6: Only reconcile `getComparison()` after lender pricing semantics are explicitly established.**
- [ ] **Step 7: Run targeted tests and verify GREEN.**

**Business guardrail:** Do not replace the borrower calculation with `referenceDataService.getComparison()` merely to eliminate code duplication; the existing formulas are not equivalent.

---

### Task 6: Verify and Harden `products` vs `bank_products` Separation

**Files:**
- Read: `src/services/adminProductService.ts`
- Read: product-management UI files.
- Read: migrations defining `products` and `bank_products`.
- Test: separation and accidental-coupling regression checks.

**Interfaces:**
- Consumes: current product schemas, migrations and lender comparison/reference-data implementation.
- Produces: a formally documented separation between generic platform products and lender loan offers. No consolidation migration is permitted without new evidence proving semantic equivalence.

- [x] **Step 1: Trace reads/writes of both models.**
- [x] **Step 2: Verify that `products` and `bank_products` are distinct domain objects.**
- [x] **Step 3: Reject the earlier duplicate-model hypothesis.**
- [x] **Step 4: Remove the semantically unrelated `products` → reference-data cache invalidation coupling from `adminProductService`.**
- [ ] **Step 5: Add an architecture regression check preventing accidental cross-model consolidation.**
- [ ] **Step 6: Verify product administration and lender comparison remain separate.**

---

### Task 7: Connect Existing Risk and Payroll Service Boundaries

**Files:**
- Read/Modify: `src/services/riskService.ts`, risk UI and dashboard callers.
- Read/Modify: `src/services/payrollService.ts`, Payroll Manager UI.
- Test: service invocation and role-boundary tests.

**Interfaces:**
- Consumes: existing risk and payroll service contracts.
- Produces: service-backed frontend paths without changing their distinct business responsibilities.

- [x] **Step 1: Route risk reads/resolution through `riskService`.**
- [x] **Step 2: Align payroll service status semantics with the actual database schema (`active`/`inactive`).**
- [x] **Step 3: Route payroll lifecycle operations through `payrollService`.**
- [x] **Step 4: Add audit logging for payroll lifecycle changes.**
- [ ] **Step 5: Add dedicated regression tests for risk/payroll service boundaries.**
- [ ] **Step 6: Run targeted tests and verify GREEN.**

---

### Task 8: Final Business-Philosophy and Security Verification

**Files:**
- Read: all changed files and migrations.
- Read: `.github/workflows/ci.yml`.
- Test: complete repository suite and deployment checks.

**Interfaces:**
- Consumes: all changes from Tasks 1-7.
- Produces: verified final capability matrix and deployment-ready state.

- [ ] **Step 1: Run full tests.**
- [ ] **Step 2: Run lint and production build.**
- [ ] **Step 3: Verify CI workflow status for the final commit.**
- [ ] **Step 4: Verify RLS/authorization for every changed backend path.**
- [ ] **Step 5: Verify no borrower UI implies Riverbanc itself lends, approves or disburses loans.**
- [ ] **Step 6: Verify no mocks/fabricated production data were introduced.**
- [ ] **Step 7: Re-run the A-F capability classification and compare it with Task 1.**
- [ ] **Step 8: Verify the deployment built from the exact final commit and reaches READY.**
- [ ] **Step 9: Only after all evidence passes, mark the relevant subsystem(s) complete.**
