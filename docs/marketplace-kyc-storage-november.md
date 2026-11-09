# Riverbanc Marketplace: November KYC storage protection

Riverbanc means **Marketplace**, repository `northghead-cpu/secure-civil-loans`,
Supabase project `zdpeaxkormwjrgllwalq`. This change does not configure lender
release workflows or connect to Handshake. Its scope is the Marketplace's
existing KYC, payslip and receipt storage during the November pilot.

## Immediate database protection

The sensitive buckets remain private and all existing files are retained.
Restrictive policies require a real, unexpired first-party `auth.sessions` row
belonging to the JWT's subject and session ID. Missing, deleted, expired,
anonymous and OAuth sessions are refused. Account suspension is checked in the
database. Privileged staff require MFA; borrowers retain their own document
access without being forced into staff MFA rules.

A separate restrictive SELECT policy prevents a future overly broad permissive
policy from granting cross-borrower reads. Existing role policies still decide
which operations are granted; this change only narrows them. There are no new
permissive grants for the payslips bucket. The validating upload function checks
the live session both before and after document parsing. Service credentials
remain server-side. New KYC uploads have cache lifetime zero; no existing file
is rewritten or deleted.

## Frontend transition and rollout order

KYC review, legacy application evidence and payment receipts fetch documents
through authenticated, no-store Storage requests. They no longer create shared signed
URLs. The browser displays/downloads a temporary local Blob URL, which is
revoked after one minute. Each new fetch is subject to the live RLS/session
checks. A document already fetched or saved cannot be retracted by logging out.

The session-protection migration is deployed. PR #79 is merged and its exact
commit is serving Marketplace production. The authenticated-document operation
policy was applied on 9 November 2026 after verifying the new production asset.
It denies new client signed URL creation, image signing, S3 reads and direct
object-table reads while preserving authenticated get/info and folder listing.
If rolling back the frontend to signed-link code, review this policy first;
old signed-link review screens intentionally fail closed under the new rule.

Existing signed URLs are bearer credentials and an RLS change does not revoke
them. The old legacy UI used one-hour URLs; other callers may have requested
different lifetimes. Do not assume every old URL expires within one hour.
For urgent URL revocation, use Supabase support rather than deleting files.

## Remaining operational work

The existing PDF/image validator performs structural checks and image
normalization. It is not an antivirus engine. The private ClamAV worker,
exact-version quarantine, encrypted S3-compatible backup, and separate recovery
verification are implemented in `ops/kyc-security`. Their real deployment still
requires an approved scanner host, private backup destination credentials and
independent recovery-key custody. No real-file scan or backup restore is claimed
until that configuration and first-run evidence exist. Database-only backups
and isolated PGlite restores do not verify document-byte recovery.

Storage API access logging is separate from a lender release audit. This patch
does not claim new, tamper-proof server-side document-download audit receipts.
No KYC bytes, browser Blob URLs or tokens are added to application persistence,
Slack, Sheets or repository files.

## November handover

The current Supabase project region is `eu-central-2`, outside Zambia.
The intended temporary period is November 2026. Before 30 November, reconcile
the retained files and their hashes, prepare the Lusaka VPS and its encrypted
backup, verify restore and access controls, then switch the storage adapter.
This patch schedules no deletions and does not automatically disable the pilot
or remove protections at month end. Retention/decommissioning follows verified
handover, not an unverified calendar-based deletion.

## Evidence

`npm run test:storage-security` runs 38 isolated PostgreSQL authorization checks,
including a hypothetical broad SELECT policy, the operation filter, exact-version
quarantine, and out-of-order scan evidence.
Frontend tests cover authenticated document access, denied access, MIME
restrictions, blocked/closed popups and local URL cleanup. These tests do not
impersonate real borrowers or establish hosted backup recovery.
