# Riverbanc–Handshake remediation verification — 11 November 2026

Status: core backend changes deployed; operational activation and hosted acceptance remain incomplete.

## Applied changes

- Signed Marketplace intake now records the provenance of borrower handoff authorization needed by the existing staff dispatch gate. Backfill is limited to accepted API events with matching source IDs and no later consent marker. Staff dispatch and lender tenant checks remain required.
- Handshake state changes queue minimal authenticated callbacks to Marketplace. HMAC signing uses the existing shared integration secret with a distinct `handshake-status-v1` signing context. Five-minute validity, tenant/lender mapping, immutable remote handshake identity, monotonic versions, idempotency, audit logging and terminal-state guards are enforced.
- Pre-approval is distinct from final approval. The lender-only final outcome RPC requires current tenant/session/MFA, a valid pre-approved handoff, a completed audited KYC download and matching current package. Disbursement requires final approval. UI controls are included in the Handshake case page.
- Marketplace KYC export now accepts review/pre-approval states. Its authorization fingerprint covers the signed handoff rather than operational `updated_at`, so status callbacks do not invalidate unchanged packages. Withdrawn consent, changed documents, wrong lenders and missing/stale malware evidence still deny export.
- Outbox worker v17 supports validated service-role scheduling while preserving interactive staff session/MFA gates, claim-token fencing, retry handling and private-channel checks. GET configuration check returned HTTP 200 without claiming jobs or contacting Slack/Sheets.
- Eight covering indexes were added across both databases. No tables, data, files, indexes, or existing audit history were deleted.

## Observed operational state

| Item | Current evidence |
|---|---|
| Marketplace callback | `handshake-status` v1 deployed, HMAC authenticated |
| Handshake worker | `process-outbox` v17 deployed, JWT verification enabled |
| Accepted historical referral | One status snapshot queued without changing its business state |
| Outbox | 51 Sheets projections and one status callback pending after additive consent/status auditing |
| Slack | Credentials present; channel IDs configured for all 11 tenants |
| Google Sheets | Credentials not configured; backlog cannot be delivered yet |
| Lenders | Mightyfinance and Handshake Test active; nine others onboarding, including Lupiya |
| Malware evidence | 75/75 current sensitive object versions have clean scan records; ClamAV definitions dated 11 November |
| Recovery | Existing receipt verifies encrypted backup retrieval, independent decryption and hash checks for all 75 objects |
| KYC packages/grants | Zero; production release gate remains disabled |
| Database location | Both projects remain in EU Central 2; Zambia residency is unresolved |

## Activation blocked by approval review

Automatic approval review rejected two production activations:

1. Installing the recurring outbox scheduler because it would transmit operational data to Slack and Google Sheets without explicit owner authorization for those destinations and recurring export.
2. Enabling KYC release because activation of sensitive document access needs explicit owner approval.

Neither action was retried or bypassed. Reviewed activation SQL is prepared under `supabase/operations/` in Handshake. No lender was activated, no document released and no Slack/email invitation sent by this remediation. Google Sheets credentials must additionally be configured through protected settings before Sheets delivery can succeed. Never put credentials in chat or Git.

## Validation

- Handshake: all 187 application tests passed in an isolated environment with network syscalls denied; this includes the expanded real SQL + synthetic KYC gateway flow and final outcome authority checks.
- Handshake: all database suites passed through 45 replayed source migrations, including tenant isolation, absent/inactive profiles, MFA, KYC grants, outbox lease recovery and callback enqueueing; isolated datadir restore/rerun passed.
- Shared signing protocol: two Node suites passed for signature tampering, expiry, secret mismatch, signing-context separation and payload identity constraints.
- Marketplace: six focused callback/progress tests passed; database callback regression passed for worker authority, selected lender, remote identity, stale/duplicate/conflicting versions, terminal states, audit and protected client fields.
- Marketplace: 15 KYC source checks passed, including stability across pre-approval callbacks and denial of changed or unscanned evidence.
- Handshake TypeScript and changed TypeScript/TSX lint checks passed. Marketplace full TypeScript could not complete locally because the reused dependency set lacks `@vercel/speed-insights`; CI must verify the fresh install/build.
- Marketplace migration-history tests passed with exact historical SQL bytes preserved. New migration filenames match actual hosted ledger versions.
- Deployed function bundles compiled successfully. A real hosted borrower-to-lender browser download and delivered reverse callback have not been demonstrated; local synthetic tests are not substituted for them.

## Remaining register

| ID | Disposition |
|---|---|
| RBH-01 lender delivery | Consent-to-dispatch blocker repaired; staff dispatch and hosted lender acceptance still needed |
| RBH-02 status synchronization | Backend deployed, callback delivery awaiting worker activation |
| RBH-03 outbox | Worker repaired; scheduler approval and missing Sheets configuration remain |
| RBH-04 KYC | Real scan/recovery evidence present; activation approval and hosted lender download remain |
| RBH-05 residency | Unresolved; no VPS, paid plan or relocation provisioned |
| RBH-06 tenant isolation | Existing isolated role/tenant regression suites pass; hosted multi-user acceptance remains |
| RBH-07 database security | Flagged public functions reviewed: anonymous execution denied, session/ownership/role guards present. Private RLS-without-policy tables intentionally deny clients; do not add permissive policies merely to suppress INFO notices. No disabled-RLS finding remained on the handoff-secret table |
| RBH-08 onboarding | Active/onboarding mappings checked; no additional tenant activated |
| RBH-09 acceptance | Synthetic SQL/gateway flow passes; full hosted browser acceptance remains |
| RBH-10 notifications | Slack present; Sheets absent; activation remains gated |
| RBH-11 audit/monitoring | Durable callback/outcome auditing and worker status checks added; ongoing external worker monitoring awaits activation |
| RBH-12 performance | Eight missing FK indexes fixed; unused-index INFO notices retained and existing policy advisories remain subject to measured tuning |
| RBH-13 deployment | Backend deployed; frontend changes prepared in source control and require normal CI/release verification |

This is not an OWASP certification or a claim of production completeness. No paid infrastructure was created. Leaked-password protection was left unchanged under the existing free-plan constraint.
