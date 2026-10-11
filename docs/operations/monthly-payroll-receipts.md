# Monthly Payroll Receipt Operations

## Production configuration

The billing ledger and receipt PDF pipeline run through Supabase Edge Functions. Configure the following server-side secrets for the billing function:

- RESEND_API_KEY — Resend API key.
- RESEND_FROM_EMAIL — verified Riverbanc sender address.

Never commit provider keys or webhook signing secrets to Git.

The Resend webhook endpoint is configured to verify Svix signatures in the database using a Vault secret named `resend_receipt_webhook_secret`. Provider acceptance is recorded as sent; `delivered_at` is populated only when a verified `email.delivered` event arrives.

## Payment source of truth

A subscription authorization is not a payment record. A one-time payroll authorization confirmation must never create a recurring paid receipt.

For each billing period, a privileged administrator or compliance reviewer must reconcile a separate monthly payroll outcome against official payroll evidence. The action requires MFA, a payroll reference for confirmed deductions, an evidence reference for either outcome, and an explicit evidence attestation. All outcomes are audit-logged.

- Confirmed monthly outcome: may produce one K60 ZMW transaction and one receipt for that period.
- Failed monthly outcome: creates no transaction or receipt for that subscriber and period.
- Missing monthly outcome: keeps the billing run pending.
- Fully reconciled run with failed outcomes: marked partial.
- Confirmed outcome without a corresponding transaction: keeps the run pending for remediation.

## Monthly flow and schedule

1. Review the correct billing month; the period starts on the 23rd of that month.
2. Match each active subscription to the official payroll register.
3. Record a confirmed or failed outcome with evidence reference and MFA.
4. At 00:05 Africa/Lusaka on the 23rd, the monthly billing job processes period-specific confirmed outcomes.
5. Dashboard receipt records become available only for confirmed transactions.
6. The Edge Function generates a private PDF and attempts email delivery.
7. Resend delivery webhooks update delivered, bounced, failed, delayed, complained, or suppressed states after signature verification.
8. Admins reconcile run totals and delivery failures from Financials Reports.

## Retries and idempotency

- Billing runs are unique by billing date; transactions are unique by subscriber and period.
- The daily retry job runs at 05:30 Africa/Lusaka.
- It revisits pending/failed runs within a 60-day backlog and retries eligible email deliveries from completed/partial runs.
- Email attempts are capped at five. Permanent bounce, complaint, and suppression events are not retried automatically.
- The Edge Function sends a Resend idempotency key per delivery attempt to reduce duplicate messages if a request is retried.


## Safe PDF/email smoke test

The billing Edge Function supports a secret-authenticated, non-financial test mode. Send a request with `mode: "test_email"`, the registered active subscriber's user ID, and a unique `test_run_id`. It generates a visibly watermarked PDF with the production PDF library and sends it to the profile's registered email address. It does not create a billing run, transaction, payment receipt, or delivery ledger row. The resulting Resend event is tagged as a test and ignored by the receipt ledger webhook after signature verification.

Use the Vault-backed cron secret to invoke the function; never expose that secret in a client or log. Confirm the function response, Resend email status, and webhook event attempt status before closing the smoke test.

## Verification safety

- Migration SQL is tested inside an explicit transaction and rolled back before deployment.
- A behavior test against the current pending billing run verifies repeated invocations remain pending and create zero transactions and receipts without monthly payroll evidence.
- A separately labelled non-payment email test validates the outbound email channel.
- Do not create synthetic paid transactions or receipts in production. Full paid-receipt acceptance testing requires an isolated test database or a real, evidence-backed payroll deduction.
