# Monthly Payroll Receipt System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a payroll-only K60 monthly billing ledger and receipt system that issues accurate receipts for confirmed deductions on the 23rd and exposes them securely to customers and admins.

**Architecture:** Extend the existing Riverbanc Supabase model rather than creating a separate billing service. `subscription_authorizations` remains the authorization source; new billing-run, transaction, receipt, and delivery tables provide a normalized financial ledger. Server-side orchestration owns payment/receipt state; the React client is read-only for financial records.

**Tech Stack:** React 18 + TypeScript + Vite + shadcn/ui; Supabase Postgres/RLS/Edge Functions/Storage; Vitest; existing Riverbanc auth and role helpers.

**Spec:** `docs/superpowers/specs/2026-09-04-monthly-payroll-receipts.md`

## Global Constraints

- Subscription fee is exactly K60.00 ZMW per month.
- Deduction method is payroll only.
- Billing/receipt cycle date is the 23rd in `Africa/Lusaka`.
- `subscription_authorizations.payroll_status = confirmed` is required before a paid receipt can be issued.
- Authorization alone is never proof of payment.
- At most one transaction and one receipt may exist per user per billing period.
- Customers cannot create or mutate financial records.
- Receipt documents are private and user-scoped.
- Do not expose service-role credentials to the browser.
- Existing Riverbanc role/RLS patterns must be preserved.
- Do not modify lender loan repayment logic.

---

### Task 1: Map existing billing and authorization boundaries

**Files:**
- Read: `supabase/migrations/20260815000001_riverbanc_subscription_authorizations.sql`
- Read: `supabase/migrations/20260815090000_harden_subscription_e_signature.sql`
- Read: `src/pages/ProfilePage.tsx`
- Read: existing audit-log migrations and relevant subscription tests

**Interfaces:**
- Consumes: existing `subscription_authorizations`, `profiles.account_status`, existing `audit_logs`, existing role helpers.
- Produces: confirmed field names and existing RLS conventions used by Tasks 2–6.

- [ ] **Step 1: Verify authorization state model**

Confirm the implementation uses the existing values `active/revoked` for authorization status and `pending/submitted/confirmed/failed` for payroll status. The existing schema explicitly states that authorization is not proof that a payroll deduction occurred. fileciteturn12file0

- [ ] **Step 2: Verify customer identity fields**

Use `profiles.full_name` and the authenticated user's email as receipt presentation data; do not duplicate regulated identity data into receipt tables unless required by the existing schema.

- [ ] **Step 3: Record existing security constraints**

Preserve existing RLS and admin role helpers; do not introduce a second authorization mechanism.

---

### Task 2: Add the financial ledger schema

**Files:**
- Create: `supabase/migrations/<generated-by-supabase-cli>_monthly_payroll_receipts.sql`
- Test: `supabase/tests/monthly_payroll_receipts.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.subscription_authorizations`, `public.audit_logs`.
- Produces: `billing_runs`, `billing_transactions`, `payment_receipts`, `receipt_deliveries` tables and constraints.

- [ ] **Step 1: Create the migration with the Supabase CLI**

Run `supabase migration new monthly_payroll_receipts` and use the generated filename. Do not hand-invent the migration filename.

- [ ] **Step 2: Create `billing_runs`**

Implement one row per Zambia billing date with a unique `billing_date`, `Africa/Lusaka` timezone, lifecycle status, counters, and timestamps.

- [ ] **Step 3: Create `billing_transactions`**

Implement a ledger row with `user_id`, `subscription_authorization_id`, exact K60.00 ZMW amount, payroll method, billing period, payroll reference, lifecycle status, confirmation timestamp, failure reason, and timestamps. Add a unique constraint over `(user_id, billing_period_start, billing_period_end)`.

- [ ] **Step 4: Create `payment_receipts`**

Implement immutable receipt metadata with a globally unique receipt number and unique `billing_transaction_id`. Do not provide customer INSERT/UPDATE/DELETE policies.

- [ ] **Step 5: Create `receipt_deliveries`**

Track email/dashboard delivery separately from financial state and enforce one delivery record per receipt/channel.

- [ ] **Step 6: Add indexes and RLS**

Add user and billing-date indexes. Enable RLS on all four tables. Customer SELECT policies must be scoped to `auth.uid() = user_id`; writes are server-side only. Admin SELECT policies must use the repository's existing role helper.

- [ ] **Step 7: Add audit events**

Record billing-run start/completion, transaction confirmation/failure, receipt issuance/voiding, and delivery attempts through the existing audit-log mechanism without logging document contents.

- [ ] **Step 8: Test schema invariants**

Run the SQL test suite against a development database and verify duplicate billing-period transactions and duplicate receipts are rejected.

---

### Task 3: Implement the 23rd billing orchestration

**Files:**
- Create: `supabase/functions/monthly-payroll-billing/index.ts`
- Create: `supabase/functions/monthly-payroll-billing/deno.json`
- Test: `supabase/tests/monthly_payroll_billing.sql`

**Interfaces:**
- Consumes: active profiles, active payroll subscription authorizations, confirmed payroll status, and the new billing tables.
- Produces: idempotent monthly `billing_runs`, `billing_transactions`, and receipt issuance requests.

- [ ] **Step 1: Define the billing-period calculation**

For a billing date on the 23rd, set `billing_period_start` to the current 23rd and `billing_period_end` to the next month's 22nd, evaluated in `Africa/Lusaka`. Store UTC timestamps after converting from Zambia local time.

- [ ] **Step 2: Make the monthly run idempotent**

Acquire/reuse the unique `billing_runs.billing_date` row. A retry must continue the same run rather than create another run.

- [ ] **Step 3: Snapshot eligible accounts**

Select profiles with `account_status = 'active'` and a matching active payroll subscription authorization. Create one pending transaction per account using the authorization's K60.00 ZMW values, not a client-supplied amount.

- [ ] **Step 4: Match confirmed payroll payment**

Only transition a transaction to `paid` when a trusted payroll reconciliation process has supplied confirmation and a payroll reference. Never infer payment from `subscription_authorizations.payroll_status = submitted`.

- [ ] **Step 5: Protect against concurrent workers**

Rely on database uniqueness plus transactional upsert/locking so simultaneous scheduler invocations cannot create duplicate transactions or receipts.

- [ ] **Step 6: Expose a controlled reconciliation operation**

The Edge Function must support a server-side operation to apply a trusted payroll confirmation reference to a transaction. It must reject client attempts to self-confirm payment.

- [ ] **Step 7: Verify orchestration**

Run tests for first execution, retry, concurrent execution, pending payroll, failed payroll, confirmed payroll, and revoked authorization.

---

### Task 4: Implement receipt issuance and document presentation

**Files:**
- Create: `src/lib/billing/receipt.ts`
- Create: `src/components/billing/ReceiptCard.tsx`
- Create: `src/pages/ReceiptPage.tsx`
- Modify: `src/App.tsx` or the existing route definition file
- Test: `src/lib/billing/__tests__/receipt.test.ts`

**Interfaces:**
- Consumes: paid `billing_transactions` and `payment_receipts` returned by Supabase.
- Produces: deterministic receipt presentation and print/download view.

- [ ] **Step 1: Write receipt formatting tests**

Test K60.00 formatting, ZMW currency, Zambia date formatting, receipt-number display, billing-period display, and payroll payment wording.

- [ ] **Step 2: Implement receipt formatting**

Create pure TypeScript formatting helpers. Keep financial amounts as decimal strings/numbers from the database and never calculate money using floating-point arithmetic in the UI.

- [ ] **Step 3: Build the receipt page**

Create a clean Riverbanc-branded receipt page containing company identity, receipt number, receipt date, customer name, billing period, K60.00 ZMW amount, payroll deduction method/reference, and the required statement that the subscription is separate from lender loan principal, interest, fees, and charges.

- [ ] **Step 4: Add secure routing**

The page must fetch only the authenticated user's receipt. Do not trust a route parameter as an authorization decision.

- [ ] **Step 5: Add print/download behavior**

Provide a browser print action with print CSS suitable for saving as PDF. The financial record remains the database receipt; the printed representation is generated from that immutable record.

- [ ] **Step 6: Verify UI behavior**

Run Vitest and the production build; manually verify the receipt route with an authenticated customer and an attempted receipt ID belonging to another user.

---

### Task 5: Add billing history to the borrower dashboard

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Create: `src/components/billing/ReceiptHistory.tsx`
- Test: `src/components/billing/__tests__/ReceiptHistory.test.tsx`

**Interfaces:**
- Consumes: authenticated user's paid receipts and delivery status.
- Produces: subscription summary, latest receipt, receipt history, and pending/failed payment states.

- [ ] **Step 1: Write component tests**

Cover empty history, latest receipt, multiple receipts, pending payment, and failed payroll states.

- [ ] **Step 2: Implement receipt history**

Add a Billing/Receipts section to the existing subscription card without changing Riverbanc's existing visual language.

- [ ] **Step 3: Add receipt actions**

Each issued receipt gets a View/Print action. Do not expose storage bucket paths or privileged URLs to the client.

- [ ] **Step 4: Verify authorization**

Confirm RLS prevents another authenticated user from querying the receipt row.

---

### Task 6: Add delivery and administrative reconciliation

**Files:**
- Create: `supabase/functions/send-payment-receipt/index.ts`
- Create: `src/pages/admin/BillingReceipts.tsx`
- Modify: existing admin navigation/routes
- Test: `src/lib/billing/__tests__/delivery.test.ts`

**Interfaces:**
- Consumes: issued receipts and delivery records.
- Produces: email delivery attempts, retry state, and admin reconciliation views.

- [ ] **Step 1: Define email delivery contract**

The receipt sender accepts only an issued receipt ID, resolves the destination server-side from the account record, creates/updates the receipt delivery row, and never accepts arbitrary recipient addresses from the browser.

- [ ] **Step 2: Implement retry-safe delivery**

A failed email increments `attempt_count`, records `failure_reason`, and remains associated with the same receipt. A retry must not issue another receipt.

- [ ] **Step 3: Add dashboard delivery state**

Record dashboard availability as a separate delivery channel once the receipt is issued.

- [ ] **Step 4: Build admin reconciliation**

Show billing date, eligible count, paid count, receipt count, failed count, delivery failures, and retry controls using existing admin authorization patterns.

- [ ] **Step 5: Verify delivery isolation**

Test that customer sessions cannot invoke privileged delivery operations and that a delivery failure does not alter `billing_transactions.status`.

---

### Task 7: Security and operational verification

**Files:**
- Modify: relevant migration/function/UI files only where verification finds a defect
- Create: `docs/monthly-payroll-receipts-runbook.md`

**Interfaces:**
- Consumes: complete billing subsystem.
- Produces: verified production-readiness evidence and operator runbook.

- [ ] **Step 1: Run Supabase security advisors**

Run the project's security advisors after DDL/RLS changes and resolve findings affecting the new billing tables/functions before release.

- [ ] **Step 2: Run application tests**

Run `npm test` and `npm run build`. Record exact results.

- [ ] **Step 3: Run lint**

Run `npm run lint` and resolve all billing-related lint errors.

- [ ] **Step 4: Verify idempotency**

Execute the monthly job twice for the same billing date and prove the transaction and receipt counts do not increase on the second run.

- [ ] **Step 5: Verify RLS**

Test customer isolation, admin access, and rejection of client-side financial writes.

- [ ] **Step 6: Document operations**

Document the 23rd scheduler, payroll confirmation/reconciliation dependency, failed-delivery retry process, audit records, and emergency handling.

- [ ] **Step 7: Final review**

Run the verification-before-completion and requesting-code-review workflows before merging the feature branch.

---

## Self-Review Checklist

- [ ] Active account eligibility is covered.
- [ ] Payroll-only payment method is enforced.
- [ ] K60.00 ZMW amount is enforced server-side.
- [ ] 23rd Africa/Lusaka cycle is covered.
- [ ] Authorization is distinct from payment confirmation.
- [ ] Duplicate transaction/receipt prevention is covered.
- [ ] Receipt delivery is independent of financial state.
- [ ] Customer RLS is covered.
- [ ] Admin reconciliation is covered.
- [ ] Dashboard history is covered.
- [ ] Print/PDF presentation is covered.
- [ ] No card/mobile-money gateway is introduced.
- [ ] No lender loan repayment logic is changed.
