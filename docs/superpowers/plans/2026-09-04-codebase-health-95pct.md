# Riverbanc Codebase Health 95% Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a reproducible, testable, secure, and mutually consistent Riverbanc state across repository, CI, production database, and deployment, targeting independently verified codebase health above 95%.

**Architecture:** Fix in dependency order. First restore repository truth and CI, then reconcile database migration provenance without destructive changes, then validate security/performance controls, then validate application/business logic and production behavior. Every change is isolated, tested, and rechecked against all four control planes before the next risk-bearing change.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, ESLint, Bun, Supabase/PostgreSQL, Vercel, GitHub Actions, Sentry.

**Spec:** `docs/superpowers/plans/2026-08-16-riverbanc-production-build-repair.md` plus the current production schema and current `main` branch state.

## Global Constraints

- Never overwrite or reset production data to repair migration drift.
- Repository, CI, production database, and deployment must independently reproduce the intended state.
- One root-cause fix at a time; no unrelated refactors.
- Bug fixes require a failing regression test before production implementation changes.
- Do not weaken security controls to make CI or advisors green.
- Do not treat informational unused-index findings as correctness failures without workload evidence.
- Do not invent dependency versions; verify published versions before changing overrides.

---

### Task 1: Restore the failing operational-event module

**Files:**
- Create: `src/lib/operationalEvents.ts`
- Modify: `src/lib/__tests__/operationalEvents.test.ts`

**Interfaces:**
- Consumes: Sentry capture APIs and `scrubDeep` from `src/lib/sentry.ts`.
- Produces: `captureOperationalEvent(input)` accepting `operation`, `severity`, `message`, and optional metadata.

- [ ] **Step 1: Strengthen the existing failing regression test**
- [ ] **Step 2: Run the focused Vitest test and verify it fails for the expected missing-module/behavior reason**
- [ ] **Step 3: Implement the smallest privacy-safe operational event wrapper**
- [ ] **Step 4: Run the focused test and full test suite**
- [ ] **Step 5: Run typecheck, lint, and production build**
- [ ] **Step 6: Commit only the module/test changes**

### Task 2: Establish a fresh CI baseline on the fixed repository

**Files:**
- Modify only if required by observed CI output: `.github/workflows/ci.yml`, dependency manifests/lockfile.

**Interfaces:**
- Consumes: Task 1 repository state.
- Produces: green test, audit, secret-scan, typecheck, lint, and production-build gates.

- [ ] **Step 1: Trigger CI from the branch**
- [ ] **Step 2: Inspect every failed job rather than relying on the first failure**
- [ ] **Step 3: Fix only the highest-priority root cause**
- [ ] **Step 4: Repeat until the complete CI gate is green**
- [ ] **Step 5: Verify the lockfile remains frozen-install compatible**

### Task 3: Reconcile repository migrations with production migration history

**Files:**
- Create: missing migration files corresponding to production-only migrations, with exact verified SQL semantics.
- Modify: migration history files only when necessary to remove repository-side duplicates or ordering defects.

**Interfaces:**
- Consumes: production migration list, production schema, functions, constraints, indexes, policies, and repository migration tree.
- Produces: a deterministic repository migration sequence whose expected end state matches production without destructive reset.

- [ ] **Step 1: Enumerate repository migration versions**
- [ ] **Step 2: Enumerate production migration versions and classify every mismatch**
- [ ] **Step 3: Recover the exact intent/state of every production-only migration from database objects and available deployment history**
- [ ] **Step 4: Add missing migrations in dependency order**
- [ ] **Step 5: Validate migration replay on an isolated database/branch only if cost-approved; otherwise use non-destructive schema/function equivalence checks**
- [ ] **Step 6: Re-query production migration history and schema**

### Task 4: Close Supabase security findings

**Files:**
- Add narrowly scoped migrations for proven security findings.

**Interfaces:**
- Consumes: Supabase advisor findings and current policy definitions.
- Produces: no unintended public access and documented intentional service-role-only tables.

- [ ] **Step 1: Verify whether RLS-without-policy tables are intentionally service-role-only**
- [ ] **Step 2: Verify leaked-password protection state and enable only if appropriate to the authentication policy**
- [ ] **Step 3: Re-run security advisors**

### Task 5: Resolve database performance findings by risk, not noise

**Files:**
- Add a single migration containing only indexes/policy rewrites proven necessary.

- [ ] **Step 1: Separate correctness/security findings from informational unused-index findings**
- [ ] **Step 2: Add missing FK indexes for write-heavy/reference paths**
- [ ] **Step 3: Fix confirmed RLS init-plan and multiple-permissive-policy warnings**
- [ ] **Step 4: Re-run performance advisors**

### Task 6: Audit underwriting and application authorization logic

**Files:**
- Inspect underwriting functions and application-handoff RPCs.
- Add regression tests before any behavior change.

- [ ] **Step 1: Verify debt-service calculations against actual repayment semantics**
- [ ] **Step 2: Verify Zambian 28/36 constraints are applied consistently**
- [ ] **Step 3: Verify lender handoff authorization is bound to the correct user/application/consent**
- [ ] **Step 4: Add failing tests for every proven defect**
- [ ] **Step 5: Apply minimal fixes and rerun the full gate**

### Task 7: Production smoke and reconciliation verification

**Files:**
- No code changes unless a verified defect is found.

- [ ] **Step 1: Verify current Vercel production deployment corresponds to the intended repository SHA**
- [ ] **Step 2: Check production runtime errors for the last 24 hours**
- [ ] **Step 3: Verify Supabase schema/migrations/functions/advisors**
- [ ] **Step 4: Verify a non-destructive applicant-to-handoff path using test-safe data**
- [ ] **Step 5: Verify monthly billing/receipt functions and idempotency without creating real charges or receipts**

### Task 8: Final 95% health gate

- [ ] Repository state verified.
- [ ] Full CI green.
- [ ] Security advisor findings classified and proven issues fixed.
- [ ] Performance advisor findings classified and proven issues fixed.
- [ ] Production migration history and repository migrations reconciled.
- [ ] Vercel deployment matches intended SHA and is healthy.
- [ ] Production runtime errors reviewed.
- [ ] Critical business/security flows have regression coverage.
- [ ] Final health percentage calculated from explicit weighted gates, with no unsupported optimism.
