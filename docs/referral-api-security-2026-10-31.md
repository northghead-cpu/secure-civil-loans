# Referral API security review — 31 October 2026

## Scope and observed implementation
Inspected deployed functions and matching GitHub source for Riverbanc `send-handshake-referral` (version 11) and Handshake `marketplace-intake` (version 7), plus database referral acceptance, grants, tenant policies, KYC request/authorization/readiness functions, and both projects' security advisors. Riverbanc source is northghead-cpu/secure-civil-loans; its Supabase project ID matches zdpeaxkormwjrgllwalq. Handshake is northghead-cpu/riverbanc-handshake-suite, project ueveurmphygyofwoyljj.

Existing controls retained: verified user identity and database staff roles on the sender; borrower handoff authorization and workflow checks; server-only HMAC secret with five-minute freshness and constant-time signature comparison on intake; explicit lender mapping; minimal referral payload; service-only database acceptance; transaction-level advisory lock and payload-hash idempotency; atomic referral/applicant/audit insertion. Ordinary clients cannot execute accept_marketplace_referral. No borrower KYC documents are sent by these endpoints.

## Fixes
- Bound body reads while streaming, including missing/false content-length, with five-second deadline and strict UTF-8; sender cap 4 KiB, intake/upstream response cap 16 KiB.
- Require JSON, reject unsupported compression, invalid JSON shapes, unknown fields and control characters. Malformed or absent upstream data can never confirm acceptance.
- Enforce persistent database quotas across function isolates; unavailable limiter fails closed. Privileged sender: 20 requests per user per 60-second window, 120 globally. Signed intake: 120 globally, 60 per tenant. Limits include retries. Return HTTP 429 and conservative Retry-After: 60. Unsigned intake calls fail signature verification before touching the database.
- Fix outbound destination to the known Handshake project's marketplace-intake endpoint; reject embedded credentials, query strings, fragments, other hosts/routes/protocols. Disable redirects so signatures cannot be forwarded to another destination.
- Match successful upstream acceptance to both event ID and reference; allowlist response fields and remove internal tenant/applicant/handshake IDs from the integration response.
- Reject disallowed browser origins, use own-property tenant-map lookups, validate finite and bounded amounts. Prevent late failed transfers from resetting accepted transfer state.
- Add safe authentication/access failure events, generated request IDs, no-store/nosniff headers, and optional explicit API version 1. Existing callers without a version header remain compatible; unsupported explicit versions are rejected. No credentials or payload contents are added to logs.

## Mapping to the 12 rules
| Rule | Treatment |
|---|---|
| Authenticate calls | User identity plus database staff roles; intake HMAC signature, intentionally no platform JWT |
| Check object access | Privileged staff-only sender and server-selected lender mapping; service-only intake RPC; existing tenant RLS and KYC checks retained |
| Rate limit | New atomic private counters with service-only RPC, fixed quotas and fail-closed behavior |
| Validate input | Stream caps, JSON schema/shape checks, amount bounds, safe upstream response parsing |
| HTTPS only | Exact HTTPS destination plus redirects disabled |
| Short-lived tokens | Existing five-minute signature freshness; custody download remains unavailable until VPS integration |
| Least privilege | No new browser privileges; private SECURITY DEFINER implementation, public SECURITY INVOKER wrapper callable by service_role only |
| No URL secrets | Destination rejects credentials/query/fragment; auth and HMAC in headers |
| Log auth failures | Safe structured rejection events, no secrets/documents |
| API versioning | Explicit optional version 1 header; incompatible explicit versions rejected; no route rename |
| Limit response data | Response allowlist removes internal IDs |
| Inventory endpoints | Both integration endpoints documented below; remaining functions listed for follow-up scope |

## Deployment order
These are source changes awaiting review/merge and production rollout; they have not been applied to the live databases or functions.

1. Apply `supabase/operations/referral-api-security.sql` to each corresponding Supabase project using a tracked migration or approved SQL operation. It is idempotent and contains no DROP, DELETE, TRUNCATE or business-data rewrites. It adds one private table and two service-only functions; counters reuse existing rows on window reset.
2. Deploy Handshake marketplace-intake, including its adjacent security.ts, with verify_jwt=false. HMAC verification is its authentication mechanism; enabling JWT would break the server-to-server sender.
3. Deploy Riverbanc send-handshake-referral, including its adjacent security.ts, with verify_jwt=true. Existing HANDSHAKE_API_URL must be exactly https://ueveurmphygyofwoyljj.supabase.co/functions/v1/marketplace-intake. Existing secret/tenant-map names remain unchanged; never copy values into the repository.
4. Use a controlled authorized referral to verify acceptance, duplicate retry without a second applicant, audit insertion, invalid-signature rejection and cross-tenant denial. Observe logs and quota behavior. Do not use a real borrower for destructive testing.
5. If rollback is needed, restore previous function versions; the additive limiter objects can remain. No data deletion is necessary.

## Validation
`node --test scripts/test-referral-security.mjs` (Node 24) exercises actual endpoint handlers with mocked Supabase/network boundaries. `node --test scripts/test-referral-limit.mjs` uses the repository's existing @electric-sql/pglite dev dependency to execute the actual SQL: grants, denied roles, quota exhaustion, repeated calls, window resets, scope validation and reapplication. Tests do not require production credentials.

Across the two repositories: 24 endpoint checks passed (shared checks run in each repository); the six shared SQL checks passed against local PGlite. Strict TypeScript checks passed against Supabase's client declarations. No production referral, KYC link or live-user session was created during verification. This is not a full live penetration test or an OWASP certification.

## KYC and remaining production requirements
KYC readiness currently returns CUSTODY_NOT_CONNECTED with a proposed download_ttl_seconds=600 and no URL. Lender requests require tenant membership, partner MFA and pre-approval. Authorization additionally requires a connected custody package and matching package fingerprint. Existing 1–168-hour authorization permission is separate from the future ten-minute download credential; it was not shortened or mistaken for a download URL. Actual VPS-side expiry, download authorization, revocation and download audit events still require the custody service and end-to-end tests.

Unauthenticated volumetric traffic needs platform/WAF protection before function execution. The new database quotas protect authenticated/signed integration operations; they do not claim to prevent all infrastructure-level denial of service. Check actual WAF/gateway coverage before declaring this complete in production. Key rotation with overlapping keys is a separate coordinated operational change; this patch does not rotate live secrets.

Security advisors: Handshake's marketplace_api_events has RLS with no client policies intentionally (service-only), and private Slack config is likewise inaccessible to ordinary clients. Riverbanc has seven existing authenticated SECURITY DEFINER RPC warnings, including authorization, payroll and support functions; do not revoke them blindly because they power user flows. Those functions require a separate implementation-level review. The existing leaked-password plan setting was not changed.

## Endpoint inventory
| Project | Function | Observed platform JWT setting | Inspection scope |
|---|---|---|---|
| Riverbanc | send-handshake-referral | true | Source/deployed/database integration inspected and hardened |
| Handshake | marketplace-intake | false | Source/deployed/database integration inspected and hardened |
| Handshake | provision-user | true | Inventory only |
| Handshake | process-outbox | true | Inventory only |
| Handshake | provision-lender-slack | true | Inventory only |
| Riverbanc | process-loan | true | Inventory only |
| Riverbanc | crb-proxy | false | Inventory only; custom auth must be checked separately |
| Riverbanc | reference-data | true | Inventory only |
| Riverbanc | sheets-export | true | Inventory only |
| Riverbanc | process-monthly-payroll-receipts | false | Inventory only; custom auth must be checked separately |
| Riverbanc | sentry-incident-webhook | false | Inventory only; signature verification must be checked separately |
| Riverbanc | aikido-incident-webhook | false | Inventory only; signature verification must be checked separately |
| Riverbanc | resend-receipt-webhook | false | Inventory only; signature verification must be checked separately |
