# Monthly Payroll Receipt Operations

## Production configuration

The billing ledger and receipt PDF pipeline are deployed to Supabase. Email delivery intentionally fails closed unless the transaction email provider is configured.

Configure these Supabase Edge Function secrets for `process-monthly-payroll-receipts`:

- `RESEND_API_KEY` — Resend API key stored as a secret. Never commit it to Git.
- `RESEND_FROM_EMAIL` — verified Riverbanc sender address.

The Edge Function uses the secrets only server-side. Missing secrets produce a failed email delivery record and never change a confirmed payment, transaction, or receipt to unpaid.

## Monthly flow

1. Payroll system confirms deductions using the server-side confirmation boundary.
2. At 00:05 Africa/Lusaka on the 23rd, the database billing job runs.
3. Only `subscription_authorizations.status = active` AND `payroll_status = confirmed` are eligible.
4. A single K60 ZMW billing transaction is created per subscriber per billing period.
5. One unique receipt is created per transaction.
6. Dashboard delivery is immediately available.
7. The Edge Function generates a private PDF and attempts email delivery.
8. Email failures are retained with attempt count and can be retried up to five attempts.
9. Admins reconcile billing runs and export the receipt ledger from Financials Reports.

## Idempotency

The billing date is unique at the run level, and `(user_id, period_start)` is unique at the transaction level. Re-running the same billing date therefore cannot create a second financial transaction or second receipt.

## Test convention

Use a future 23rd date with zero active/confirmed subscribers for a non-financial smoke test. Do not insert synthetic paid transactions into production merely to test the ledger.
