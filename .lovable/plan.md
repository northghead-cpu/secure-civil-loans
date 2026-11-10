# Riverbanc Email System Audit (report only, no changes made this turn)

## 1. Email provider actually configured
- Project sender email domain: none configured (Lovable email setup status: not_started).
- Project secrets: only `GOOGLE_SHEETS_API_KEY` and `LOVABLE_API_KEY`. No Resend, Brevo, Mailgun, SendGrid or Postmark key.
- Workspace connections: a "Brian's Resend" connection exists but is NOT linked to this project. No Brevo or Mailgun connection exists.
- Codebase: no email-sending code, no email templates, no `auth-email-hook` or send-email functions.
- Conclusion: no transactional email provider is connected to Riverbanc. Auth emails go out through the default Lovable sender with default templates.

## 2. Signup confirmation / welcome email
- Signup sets `emailRedirectTo` to `<current site>/login` (plus `?next=` when present); the `/login` route exists.
- Emails use the default unbranded template and sender. There is no separate welcome email.
- Not verified: whether `https://riverbanc.co.zm` is on the allowed redirect list. No custom domain is attached to this project (only riverbanc.lovable.app), so links that start on the live domain may be refused.

## 3. Password reset and the /auth/callback flow
- The app has no `/auth/callback` route. Before last turn's fix, reset links led to the "page not found" page.
- Current state: the Forgot Password page now redirects to `<current site>/reset-password`. That page handles both `?code=` (PKCE) and hash-token (`type=recovery`) links, then signs the user out once the password is changed.
- Remaining gap: the same as the redirect allowlist / custom domain gap in section 2.

## 4. Receipt emails
- No receipt implementation exists in the code or the backend functions.
- Live database: there is no payments, receipts, invoices or transactions table. `payouts` holds payouts to lenders, not customer payments.
- The `subscription_authorizations` (K60/month) migration exists in the repo but the table is not in the live database.
- No payment provider or webhook confirms a successful customer payment, so there is no real event to send a receipt from.

## 5. Other configuration mismatch
- `supabase/config.toml` and the fallback in `src/integrations/supabase/config.ts` point to a different backend project (`zdpeax...`) from the one the app actually uses (`amjbv...`, via the environment settings). This is harmless today, but it's misleading and risky if the environment settings ever go missing.

## Human actions required
1. Pick an email path: Lovable built-in email (add a domain you own, e.g. riverbanc.co.zm, via the email setup dialog), or explicitly choose Resend (link the connection and verify the domain in Resend).
2. Connect riverbanc.co.zm as the project's custom domain. Make sure `https://riverbanc.co.zm/login` and `/reset-password` are allowed sign-in redirect URLs.
3. Name the source of truth for successful payments (payment provider or payroll-deduction confirmation process), so receipts can be tied to a real paid record.
4. Decide whether the missing `subscription_authorizations` migration should be applied to the live database.

## Proposed next steps (only after the actions above)
- Branded Riverbanc verification and password-reset emails, using the managed auth email templates.
- A `payments`/`receipts` record written only on confirmed success, plus a receipt app email triggered from it. The receipt uses an idempotency key derived from the receipt ID, and logs contain no PII or tokens.
