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
through authenticated Storage requests. They no longer create shared signed
URLs. The browser displays/downloads a temporary local Blob URL, which is
revoked after one minute. Each new fetch is subject to the live RLS/session
checks. A document already fetched or saved cannot be retracted by logging out.

Apply the session-protection migration first. Merge and deploy the updated
Marketplace frontend and verify staff viewing, borrower receipts and KYC
uploads. Only then apply
`supabase/operations/marketplace_authenticated_document_reads.sql` to deny new
client signed URL creation, image signing, S3 reads and direct object-table
reads. It preserves authenticated get/info and folder listing operations.
Do not apply that final operation policy to a deployment still using signed
links; the old review screens would fail closed.

Existing signed URLs are bearer credentials and an RLS change does not revoke
them. The old legacy UI used one-hour URLs; other callers may have requested
different lifetimes. Do not assume every old URL expires within one hour.
For urgent URL revocation, use Supabase support rather than deleting files.

## Remaining operational work

The existing PDF/image validator performs structural checks and image
normalization. It is not an antivirus engine. A trusted malware scanner and an
independently encrypted backup of object bytes, with a verified restore, still
need to be configured. Database-only backups and isolated PGlite restores do
not verify document-byte recovery. Supabase platform storage encryption is not
application-level encryption with independently held keys.

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

`npm run test:storage-security` runs 24 isolated PostgreSQL authorization checks,
including a hypothetical broad SELECT policy and the staged operation filter.
Frontend tests cover authenticated document access, denied access, MIME
restrictions, blocked/closed popups and local URL cleanup. These tests do not
impersonate real borrowers or establish hosted backup recovery.
