# Riverbanc Marketplace → Handshake integration

## Source repository
`northghead-cpu/secure-civil-loans` — Riverbanc Marketplace.

## Sender endpoint
Supabase Edge Function: `send-handshake-referral` (JWT verification enabled).
It is called only after `authorize_application_handoff` has created an authorized application handoff.

## Required Edge Function secrets
Configure these in the Riverbanc Marketplace Supabase project `zdpeaxkormwjrgllwalq`:
- `HANDSHAKE_API_URL`: full HTTPS URL of Handshake's `marketplace-intake` endpoint.
- `RIVERBANC_HANDSHAKE_HMAC_SECRET`: a random secret of at least 32 characters. Use the same value in Handshake as `RIVERBANC_MARKETPLACE_HMAC_SECRET`. Never place it in browser environment variables or Git.
- `RIVERBANC_HANDSHAKE_TENANT_MAP`: JSON mapping of exact lender names in `bank_products.bank_name` to configured Handshake tenant short names. Example shape only: `{"Exact lender name":"configured_tenant_short_name"}`. Do not configure mappings until the intended tenant records are created and verified.

## Data contract
The sender validates the caller's JWT, loads the handoff by both handoff ID and authenticated user ID, and requires a persisted authorized status, signature, version and timestamp. It sends only:
- Stable event ID (the authorized handoff UUID)
- Configured destination tenant short name
- Riverbanc handoff reference
- Pseudonymous applicant alias
- Requested amount in ZMW

No NRC, TPIN, legal name, phone, salary, bank details, payslip, KYC file or raw underwriting data is sent by this API. The Handshake tenant must be configured before the API can accept the referral.

## Signature
The sender calculates HMAC-SHA256 over `<unix timestamp>.<exact raw JSON body>` and sends the timestamp and hex signature in `x-riverbanc-timestamp` and `x-riverbanc-signature`. Handshake verifies both the signature and five-minute clock skew. The same stable event ID makes retries idempotent.

## Deployment and QA
1. Apply the Handshake migration and deploy Handshake's `marketplace-intake` Edge Function.
2. Configure the shared HMAC secret on both projects.
3. Create and activate the intended tenant(s), enable their portals, and set the lender-to-tenant map in Riverbanc.
4. Deploy this function with JWT verification enabled.
5. Wire the post-authorization UI to invoke it (included in this branch).
6. Verify authorized handoff only, wrong-user rejection, missing tenant mapping, invalid HMAC, duplicate retry, conflicting idempotency payload, expired timestamp, timeout, and successful queueing.
7. Confirm referral appears in the correct Handshake tenant and that no sensitive identity or income fields were transmitted.

## Current limitation
Creating a Handshake queue entry is not the same as delivering an application to the lender. Actual lender delivery requires a separately agreed and tested delivery channel.
