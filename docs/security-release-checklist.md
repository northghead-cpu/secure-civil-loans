# Security repair release checklist

This change tightens privileged authorization, adds a validating KYC intake, repairs personal-data exports and binds KYC reviews to the loaded revision. Deployment and verification of hosted settings are separate release steps.

## Database and deployment

The amended `20261024064302_cloudflare_audit_remediation.sql` migration was absent from both assessed environments' original histories. It now tolerates their existing revision column/trigger and repeated policy installation. Do not rewrite this migration on an environment that already ran a different version without explicitly reconciling its history.

An equivalent repair was applied only to the isolated assessment backend under provider-generated migration `20261104190116_assessment_authorization_and_intake_repairs`. The repaired development branch has separate schema-history repairs and must not be merged into production wholesale.

Before production release:

1. Confirm the intended project and current schema/history. Take the normal database backup and retain the previous frontend/function deployments.
2. Verify real provider-issued AAL2 staff sessions, including the relevant staff roles and sensitive buckets. Transaction-local SQL claims and mocked tests do not establish provider enrollment/verification.
3. Build and protect a preview with explicit staging Supabase variables and telemetry disabled. Do not use a preview's production backend fallback for testing.
4. Coordinate the reviewed migration, five Edge functions (`process-loan`, `crb-proxy`, `sheets-export`, `send-handshake-referral`, `upload-kyc-document`) and frontend cutover. The new frontend needs the new RPCs/intake; the restrictive Storage policy deliberately blocks older clients' direct KYC writes. Use a controlled release window and require refresh of old clients. Never add a raw-upload fallback.
5. Retest owner/cross-owner access, staff AAL1 denial and real AAL2 allowance, borrower support, successful JSON export/audit, fresh/stale KYC reviews and valid/invalid uploads on the exact release. Provider dispatch must use controlled recipients first.

Rollback must be coordinated: restoring the old frontend alone leaves its raw KYC uploads blocked. Prefer correcting forward. Do not remove MFA policies or restore arbitrary audit-writing grants as a rollback shortcut.

## Auth configuration remains a hosted action

The local `config.toml` expresses an eight-character minimum, 12-hour timebox, 30-minute inactivity limit and TOTP enrollment/verification. Editing it does not establish those values on a hosted project.

Read and merge only the intended hosted settings; do not push a local default Site URL/provider configuration over production. Set the intended server minimum and compromised-password protection, verify session limits/refresh behavior, and prove boundary values through signup/change/recovery. Enable staging TOTP and test real AAL2 before sign-off. The operator deferred hosted Auth changes during this repair.

The recovery frontend keeps the canonical reset URL only for the production backend. Staging returns to its own origin. Its exact reset callback must also be in the staging Auth allowlist; avoid broad preview-domain wildcards. Finish browser callback/PKCE, elapsed expiry and pre-existing-session revocation tests.

Auth references: [hosted settings API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [local session configuration](https://supabase.com/docs/guides/local-development/cli/config).

## Document and financial boundaries

The trusted intake parses flat PDFs (up to 100 pages) and decodes/re-encodes JPG/PNG images (up to four megapixels), with a five-MiB byte limit and body deadline. Active PDF features, encryption, MIME/signature mismatch, malformed/truncated files, oversized dimensions and animated PNGs are rejected. This is structural validation, not a malware-scan verdict. Historical objects have not been revalidated. Add quarantine/scanning if required by the document-processing threat model.

The `payouts` table is a lender commission register, not a borrower relationship. It is excluded from borrower exports. Client writes remain unavailable, and processing/disbursement/paid transitions fail with a defined error until a separate reviewed settlement workflow exists. This change does not introduce a transfer service or bypass payroll authorization.

Parser references: [PDF-LIB loading API](https://pdf-lib.js.org/docs/api/classes/pdfdocument), [JPEG decoder limits](https://github.com/jpeg-js/jpeg-js), [PNG parser/CRC options](https://github.com/pngjs/pngjs).

## Browser policy and telemetry

The CSP pins the two owned backend origins and the configured Sentry ingestion origin. Inline structured-data scripts use hashes; inline executable scripts are not broadly allowed. `node scripts/update-csp.mjs` updates hashes after an intentional HTML change; supply `VITE_SENTRY_ORIGIN` when changing the reviewed ingestion origin. Commit the updated policy before deployment. The build checks both source and output hashes.

Telemetry emits a newly constructed event with generic messages and bundle frame locations. Arbitrary event text/context/identity, attachments, breadcrumbs, tracing and replay are excluded. Explicit global error handlers remain enabled. Verify a synthetic event against the configured monitoring project after release.

## Mail-domain hardening

DMARC enforcement is an operational change. Inventory legitimate Google/transactional senders, verify aligned SPF/DKIM, and establish an existing monitored aggregate-report address before changing policy. Review reports, then advance through a limited quarantine rollout and eventual reject policy with delivery monitoring. No DNS enforcement change or spoofed delivery test is part of this code release. Do not invent a reporting mailbox or tighten policy without sender evidence.

Reference: [Google's DMARC rollout guidance](https://knowledge.workspace.google.com/admin/security/recommended-dmarc-rollout).
