# Riverbanc Monthly Payroll Receipt System Specification

## Goal
Provide every active Riverbanc subscriber with an accurate monthly K60 ZMW payment receipt tied to the payroll deduction ledger, delivered on the 23rd of each month and retained in the account history.

## Fixed Business Rules
- Riverbanc subscription fee: K60.00 ZMW per month.
- Deduction method: payroll only. No card, mobile-money, or bank-gateway billing is part of this feature.
- Billing/receipt cycle date: the 23rd of every month, Africa/Lusaka.
- Eligibility: account must be active and have an active payroll subscription authorization at the billing cutoff.
- A subscription authorization is not proof of payment. Existing `subscription_authorizations.payroll_status` must reach `confirmed` before a receipt is represented as a paid receipt.
- A failed or pending payroll deduction must never produce a receipt falsely stating that payment was completed.
- At most one paid transaction and one receipt may exist for an account for a billing period.
- Receipt records are immutable financial evidence; corrections happen through adjustment/reversal records, not mutation of the original receipt.

## Payment Lifecycle
1. Monthly billing run opens for the 23rd billing date.
2. Eligible active payroll authorizations are snapshotted into billing transactions.
3. Payroll deduction is matched to the transaction using the payroll/provider reference when confirmation is received.
4. Confirmed deductions transition the transaction to `paid`.
5. A unique receipt number is generated and a receipt record is created exactly once.
6. Receipt delivery is queued independently of financial state.
7. Email delivery and dashboard availability are tracked separately from payment state.
8. Failed delivery is retryable without creating another transaction or receipt.

## Data Model

### `billing_runs`
One record per monthly cycle. Fields include:
- id
- billing_date
- period_start
- period_end
- timezone
- status (`pending`, `processing`, `completed`, `completed_with_errors`, `failed`)
- eligible_count
- paid_count
- receipt_count
- failed_count
- started_at
- completed_at
- created_at

Unique constraint: one run per `billing_date`.

### `billing_transactions`
Financial ledger entry for each account and billing period. Fields include:
- id
- billing_run_id
- user_id
- subscription_authorization_id
- amount (`60.00`)
- currency (`ZMW`)
- deduction_method (`payroll`)
- billing_period_start
- billing_period_end
- payroll_reference
- status (`pending`, `submitted`, `paid`, `failed`, `reversed`)
- confirmed_at
- failure_reason
- created_at
- updated_at

Unique constraint: `(user_id, billing_period_start, billing_period_end)`.

### `payment_receipts`
Immutable receipt ledger. Fields include:
- id
- billing_transaction_id
- user_id
- receipt_number
- receipt_date
- billing_period_start
- billing_period_end
- amount
- currency
- payment_method (`payroll deduction`)
- payment_reference
- status (`issued`, `voided`)
- document_path
- created_at

Unique constraints: `receipt_number` and `billing_transaction_id`.

### `receipt_deliveries`
Delivery/audit state independent of payment state. Fields include:
- id
- receipt_id
- channel (`email`, `dashboard`)
- destination
- status (`queued`, `sent`, `failed`)
- attempt_count
- last_attempt_at
- delivered_at
- provider_message_id
- failure_reason
- created_at
- updated_at

Unique constraint: `(receipt_id, channel)`.

## Security
- Enable RLS on every exposed billing table.
- Customers may select only their own transactions, receipts, and delivery records.
- Customers cannot insert, update, delete, or mark their own transactions/receipts as paid.
- Billing orchestration and receipt issuance execute server-side only.
- No service-role key or secret is exposed to the React client.
- Receipt documents are stored in a private bucket with user-scoped access; do not expose public object URLs.
- Administrative access uses existing Riverbanc role checks.
- Audit events record billing-run execution, transaction state changes, receipt issuance, voiding, and delivery attempts without logging sensitive document contents.

## Idempotency
The 23rd scheduler may retry. Re-running the same billing date must reuse the existing `billing_runs` record and existing per-user transaction rows. Receipt issuance must be protected by database uniqueness so concurrent workers cannot issue duplicate receipts.

## Customer Experience
Add a Billing/Receipts section to the existing borrower dashboard. It should show:
- Current subscription: K60/month, payroll deduction.
- Latest paid receipt and receipt number.
- Payment date and billing period.
- Payment reference when available.
- Receipt history.
- Print/download action for each receipt.
- Clear state when a payroll deduction is pending or failed; never label those states as paid.

## Receipt Content
The receipt must identify:
- RIVERBANC TECHNOLOGY LIMITED
- Riverbanc platform subscription fee
- Receipt number
- Receipt date
- Customer name
- Billing period
- Amount: K60.00 ZMW
- Payment method: Payroll deduction
- Payroll/payment reference when available
- Statement that the subscription fee is separate from lender loan principal, interest, fees, and charges.

## Non-Goals
- No card/mobile-money payment gateway.
- No lender loan repayment receipts.
- No changes to lender underwriting or loan application logic.
- No automatic account suspension logic is introduced by this feature.
- No assumption that subscription authorization equals payment confirmation.

## Acceptance Criteria
1. An active payroll subscriber with a confirmed K60 deduction has exactly one paid transaction and exactly one receipt for the monthly period.
2. Re-running the 23rd job does not duplicate either record.
3. Pending/failed payroll deductions do not create paid receipts.
4. A user can only see their own receipts.
5. Admins can reconcile billing runs and delivery failures.
6. Receipt delivery can fail and be retried without altering the financial ledger.
7. The system preserves the distinction between authorization, payroll submission, payment confirmation, receipt issuance, and receipt delivery.
