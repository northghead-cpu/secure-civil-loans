# Direct Riverbanc customer workbook connection

The Customer Data Sheet now talks directly to the Google Sheets API from the
Marketplace `sheets-export` Edge Function. It no longer uses a Lovable gateway,
Lovable credentials or Lovable credits. It does not alter database schema,
source customer records or KYC files.

## One-time owner configuration

1. In Google Cloud, select or create a project and enable **Google Sheets API**.
2. Create a dedicated service account, for example `riverbanc-customer-reports`.
   No Google Cloud project IAM role and no domain-wide delegation are required
   for writing a spreadsheet explicitly shared with this account.
3. Create a JSON key for this account. Keep the downloaded file private.
4. In Marketplace Supabase project `zdpeaxkormwjrgllwalq`, open **Edge Functions
   → Secrets** and save the entire JSON as `GOOGLE_SERVICE_ACCOUNT_JSON`.
   Never put it in a VITE variable, the frontend, Git, chat, or Google Sheets.
5. Use a dedicated Google spreadsheet owned by Riverbanc. Share only that
   workbook with the JSON file's `client_email` as **Editor**. Keep general
   access **Restricted**. Do not use a workbook containing unrelated manual
   data in the twelve reporting tabs: refresh replaces their reporting cells.
6. Optionally pin this workbook's ID as `GOOGLE_CUSTOMER_SHEET_ID` in the same
   secure server settings. When pinned, another workbook is rejected.
7. Sign in to Riverbanc as admin/super-admin, complete MFA and open
   **Financials → Customer Data Sheet**. Enter the workbook link or ID and click
   **Check connection**. This checks access without reading/exporting customer
   tables and without changing sync history. Then click **Sync now**.

A service account cannot own personal Drive files; the application therefore
updates a privately shared workbook instead of trying to create one under that
account. The direct integration requests only the Google Sheets scope, not
Drive-wide access or impersonation of users. It creates missing reporting tabs
inside the selected workbook and retains other tabs.

## Preserved controls

- Existing current-session, active-account, admin/super-admin and MFA checks.
- Existing request body bounds, anti-replay/rate controls and audit trail.
- Existing twelve-tab reporting model; raw NRC is masked.
- Passwords, OTPs, session/auth tokens, signatures, raw KYC/payslip files and
  audit payloads are not exported. RAW value input prevents formula execution.
- Google endpoints and token audience are fixed, redirects are rejected and
  signed JWTs use a dedicated Sheets signing request. Credential-supplied token
  URLs are ignored. Private keys/access tokens/provider bodies are never logged
  or returned. Failed writes are not automatically retried.
- Server credentials being present does not prove workbook access. Only the
  read-only connection check or a successful sync establishes that access.

## Verification and limits

Synthetic tests cover OAuth signature/scope/audience, token caching/refresh,
invalid configuration, invalid destinations, provider denials, read-only checks,
admin/MFA denial, all twelve tab writes, NRC masking and secret exclusion.
CI also checks the Edge Function with Deno and runs the existing app checks.

Production activation still requires the owner's real Google credential and
workbook sharing. No live customer export is claimed until these are configured
and a successful sync is verified. No recurring export is enabled by this change.
