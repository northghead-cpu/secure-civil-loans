# Production Backend Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock behavior in `crb-proxy` and `process-loan`, wire both to production-safe backend workflows, deploy only verified functions, and reconcile all failures without regressing Phase 1/2 work.

**Architecture:** `crb-proxy` becomes a fail-closed authenticated adapter around the real CRB provider, normalizing authoritative provider data into the existing `credit_checks` model. `process-loan` remains the Riverbanc underwriting/qualification service, using the existing underwriting RPC and application records without representing Riverbanc as a lender. Both functions retain server-side auth, RBAC, RLS, audit, and secret isolation.

**Tech Stack:** Supabase Edge Functions, Deno/TypeScript, Supabase Postgres/RPC/RLS, React/Vite caller paths, Vercel CI.

**Spec:** `docs/superpowers/specs/2026-08-17-production-backend-functions-design.md`

## Global Constraints

- Keep both functions as production capabilities.
- Remove mock/random/simulated provider behavior; never replace it with fabricated responses.
- No UI/UX redesign.
- Do not change Riverbanc into a lender.
- Preserve existing Phase 1/2 security hardening and RBAC.
- Keep `private.application_handoff_secrets` unchanged.
- Do not expose production secrets in code, logs, commits, or browser responses.
- Missing external-provider configuration must fail closed with a safe error.

---

## Task 1 — Baseline and provider-contract inventory

- [ ] Map every caller of `crb-proxy` and `process-loan`.
- [ ] Map every database table/RPC each function reads or writes.
- [ ] Identify existing provider configuration variables and expected secret names.
- [ ] Identify any existing CRB provider client/schema or integration contract already present in the repository.
- [ ] Identify whether the real CRB provider has a sandbox/test endpoint available through existing configuration; do not invent credentials.
- [ ] Identify all mock/random/static fallback paths in both functions.
- [ ] Record exact files to change before implementation.
- [ ] Run existing relevant tests/build checks and record the baseline.

## Task 2 — `crb-proxy` contract tests

- [ ] Add tests for successful authoritative provider response normalization.
- [ ] Add tests for malformed provider responses.
- [ ] Add tests for provider timeout/error.
- [ ] Add tests proving no random/mock values are generated.
- [ ] Add tests for missing production configuration returning a safe failure.
- [ ] Add tests for authentication and admin/super-admin authorization.
- [ ] Run the new tests and confirm expected failures before implementation where the existing test harness permits it.

## Task 3 — Replace `crb-proxy` mock implementation

- [ ] Replace the simulated CRB response generator with the real provider adapter.
- [ ] Validate the provider response before persistence.
- [ ] Normalize provider fields into the existing `credit_checks` contract.
- [ ] Preserve NRC handling/masking rules.
- [ ] Preserve request ID, replay protection, rate limiting, and audit behavior.
- [ ] Ensure provider failures never produce a synthetic credit result.
- [ ] Run unit/contract tests.
- [ ] Run type/build checks.

## Task 4 — `process-loan` contract and semantic tests

- [ ] Test valid application/underwriting input.
- [ ] Test missing/invalid application data.
- [ ] Test underwriting RPC failure.
- [ ] Test database write failure.
- [ ] Test authenticated role enforcement.
- [ ] Test that outputs represent affordability/risk qualification rather than Riverbanc lending.
- [ ] Test that no mock score/limit/interest-rate fallback remains.

## Task 5 — Make `process-loan` production-safe

- [ ] Remove any mock/placeholder result generation.
- [ ] Use the existing production underwriting RPC as the source of truth.
- [ ] Reconcile writes to `underwriting_queue` and `loan_results` with the current schema and lifecycle.
- [ ] Ensure the function cannot create a misleading lender-of-record outcome.
- [ ] Preserve audit and role controls.
- [ ] Run tests and build checks.

## Task 6 — Production configuration reconciliation

- [ ] Verify required CRB provider secrets/endpoints exist in the production secret configuration without printing values.
- [ ] Verify required Supabase function configuration.
- [ ] Verify `process-loan` requires no undeclared mock configuration.
- [ ] If a required external credential is genuinely absent, stop that deployment path and report the exact missing configuration without fabricating it.
- [ ] Verify no secret is hard-coded.

## Task 7 — Deploy and invoke `crb-proxy`

- [ ] Deploy only the verified `crb-proxy` implementation.
- [ ] Verify deployment status.
- [ ] Invoke through the existing Admin caller using a safe provider test/sandbox request where available.
- [ ] Verify the returned result is authoritative provider data.
- [ ] Verify persistence to `credit_checks`.
- [ ] Verify audit record creation.
- [ ] Verify unauthorized invocation is rejected.
- [ ] Re-run CI/build.

## Task 8 — Deploy and invoke `process-loan`

- [ ] Deploy only after Task 5 passes.
- [ ] Verify deployment status.
- [ ] Exercise a safe controlled application/underwriting path.
- [ ] Verify underwriting result persistence.
- [ ] Verify audit trail.
- [ ] Verify Riverbanc remains a qualification/comparison layer.
- [ ] Verify unauthorized invocation is rejected.
- [ ] Re-run CI/build.

## Task 9 — Full reconciliation

- [ ] Compare changed files against the approved scope.
- [ ] Re-run all relevant CI/workflow runs.
- [ ] Investigate and fix every newly introduced failure before reporting completion.
- [ ] Re-run failed checks until verified green or until a genuine external dependency blocks progress.
- [ ] Re-test Phase 1/2 critical paths.
- [ ] Re-check Supabase security advisor.
- [ ] Verify no UI/UX changes were introduced.
- [ ] Verify no secrets were committed or exposed.
- [ ] Verify both production functions are deployed and their required production paths work.

## Completion Gate

The task closes only when both functions are either verified production-ready and deployed, or a specific external dependency that cannot be supplied from the available environment is documented. No mock data may remain in a production execution path.
