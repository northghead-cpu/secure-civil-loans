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

Use the repository's exact current branch and record the commit SHA before interpreting any search result. Do not rely on default-branch GitHub code-search snippets when an exact branch file fetch is available.

- [ ] **Step 2: Inventory frontend routes and components**

Map each actor-facing route/component to the domain capability it exposes. Record borrower, operations/admin, lender/partner or system ownership.

- [ ] **Step 3: Inventory services and Edge Functions**

For each service/Edge Function, record public methods, data source, authorization boundary and frontend callers.

- [ ] **Step 4: Inventory database/RPC ownership**

For each material capability, identify tables, RPCs, RLS policies and migration provenance that establish the authoritative backend boundary.

- [ ] **Step 5: Classify each capability A-F**

Do not classify based on filename alone. Require evidence of an execution path for A/B/C/E and evidence of intentional non-UI purpose for F.

- [ ] **Step 6: Write the verified matrix to the architecture documentation**

Document only findings that are supported by current-branch evidence. Explicitly separate missing UI from service bypass and duplicate data ownership.

- [ ] **Step 7: Commit the audit documentation**

```bash
git add docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: define Riverbanc capability boundaries"
```

---

### Task 2: Define the Application Handoff Operations Boundary

**Files:**
- Read: `src/components/LenderHandoffModal.tsx`
- Read: `src/pages/ApplicationStatusPage.tsx`
- Read: `supabase/migrations/20260815120000_remove_mock_lender_seed_and_add_application_handoffs.sql`
- Read: `supabase/migrations/20260815130000_add_application_tracking_statuses.sql`
- Read: `supabase/migrations/20260815150000_secure_application_handoff_authorization.sql`
- Read: `supabase/migrations/20260815151000_tighten_application_handoff_table_privileges.sql`
- Create/Modify: handoff service/component/page files only after Task 1 confirms the exact ownership model.
- Test: corresponding Vitest/component/service tests.

**Interfaces:**
- Consumes: existing `application_handoffs` lifecycle and authorization RPC.
- Produces: an operations-facing handoff workflow that can inspect and manage lender handoff status without changing borrower authorization semantics.

- [ ] **Step 1: Write failing tests for actor separation**

Test that borrower-facing authorization remains limited to the existing authorization path and that the new operations surface requires the intended administrative/compliance roles.

- [ ] **Step 2: Run the targeted tests and verify RED**

Run the repository's Vitest command against the new tests. The expected failure is absence of the new operations boundary, not a database connectivity failure.

- [ ] **Step 3: Implement the minimum operations boundary**

Expose the existing handoff lifecycle for authorized operations users. Do not add borrower mutation controls for lender-controlled milestones and do not imply that Riverbanc makes the lender decision.

- [ ] **Step 4: Add explicit lifecycle semantics**

Display supported statuses such as selected, authorized, preparing, sent, received, under review, additional information required, approved, declined and disbursed as lender/application milestones. Preserve lender ownership of approval/decline/disbursement.

- [ ] **Step 5: Add audit coverage for consequential operations actions**

Ensure status-management actions use the established audit boundary and do not create an unlogged alternate write path.

- [ ] **Step 6: Run targeted tests and verify GREEN**

Run the relevant Vitest tests and lint/type/build checks required by the repository. Fix only verified failures.

- [ ] **Step 7: Commit the bounded subsystem**

```bash
git add src supabase docs
git commit -m "feat: expose lender handoff operations boundary"
```

---

### Task 3: Borrower Notification Centre

**Files:**
- Read: existing `NotificationCenter` and notification generation code.
- Modify: borrower application shell/navigation only where necessary to mount the existing component.
- Test: notification navigation/rendering tests.

**Interfaces:**
- Consumes: existing borrower notification types and `notificationForApplicationStatus()`.
- Produces: an actually mounted borrower notification surface without introducing a second notification model.

- [ ] **Step 1: Write failing mount/navigation tests.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Mount the existing NotificationCenter in the borrower shell.**
- [ ] **Step 4: Verify status notifications route to the correct borrower application context.**
- [ ] **Step 5: Run targeted tests and verify GREEN.**
- [ ] **Step 6: Commit.**

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

### Task 5: Reference-Data Boundary Consolidation

**Files:**
- Modify: `src/pages/ComparePage.tsx`
- Read/Modify: `src/services/referenceDataService.ts`
- Read: `supabase/functions/reference-data/**`
- Test: comparison/reference-data service tests.

**Interfaces:**
- Consumes: `referenceDataService.getCatalogue()` and `getComparison(amount, termMonths)`.
- Produces: comparison UI backed by the authoritative reference-data path rather than a duplicate direct query/calculation path.

- [ ] **Step 1: Write failing tests for comparison service usage and equivalent output.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Replace the duplicate comparison data/calculation path with the authoritative service contract.**
- [ ] **Step 4: Preserve borrower-facing comparison behavior and Riverbanc marketplace disclosure.**
- [ ] **Step 5: Run targeted tests and verify GREEN.**
- [ ] **Step 6: Commit.**

---

### Task 6: Resolve `products` vs `bank_products` Ownership Before Any Migration

**Files:**
- Read: `src/services/adminProductService.ts`
- Read: product-management UI files.
- Read: `supabase/migrations/**` defining `products` and `bank_products`.
- Test: authoritative ownership and write/read consistency.

**Interfaces:**
- Consumes: current product schema, migrations and reference-data implementation.
- Produces: a documented authoritative product model. Only after evidence supports it may a service/UI be changed or retired.

- [ ] **Step 1: Trace every read/write of both models.**
- [ ] **Step 2: Identify whether `products` and `bank_products` represent distinct domain objects or duplicate the same object.**
- [ ] **Step 3: Write failing regression tests for the chosen ownership rule.**
- [ ] **Step 4: Implement the minimum consolidation or formal separation.**
- [ ] **Step 5: Verify product administration and comparison remain consistent.**
- [ ] **Step 6: Commit.**

---

### Task 7: Connect Existing Risk and Payroll Service Boundaries

**Files:**
- Read/Modify: `src/services/riskService.ts`, risk UI and dashboard callers.
- Read/Modify: `src/services/payrollService.ts`, Payroll Manager UI.
- Test: service invocation and role-boundary tests.

**Interfaces:**
- Consumes: existing risk and payroll service contracts.
- Produces: service-backed frontend paths without changing their distinct business responsibilities.

- [ ] **Step 1: Write failing tests proving UI paths use the service boundary.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Replace direct data access with service calls where the service is authoritative.**
- [ ] **Step 4: Preserve role gating and existing operational semantics.**
- [ ] **Step 5: Run targeted tests and verify GREEN.**
- [ ] **Step 6: Commit.**

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
- [ ] **Step 5: Verify no borrower UI implies Riverbanc itself lends, approves or disburses funds.**
- [ ] **Step 6: Verify no mocks/fabricated production data were introduced.**
- [ ] **Step 7: Re-run the A-F capability classification and compare it with Task 1.**
- [ ] **Step 8: Verify the deployment built from the exact final commit and reaches READY.**
- [ ] **Step 9: Only after all evidence passes, mark the relevant subsystem(s) complete.**
