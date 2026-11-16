# Marketplace payslip manipulation review

This integration is advisory. No result verifies authenticity, approves KYC,
rejects an applicant, changes a referral, or deletes original evidence.

The additive SQL queues PAYSLIP records, including existing inventory. PDF files
are analyzed by a bounded GitHub-hosted Python worker; image files are explicitly
unsupported. Staff with an active first-party session and MFA read results using
the existing KYC review screen. The private jobs table is not browser-accessible.

The gateway validates GitHub's signed OIDC identity, immutable repository/owner
IDs, production workflow path, production ref, GitHub-hosted runner and event.
No database key is stored in GitHub. Forks and PR workflows cannot access it.
Each claim has a random lease and binds to the exact storage object version.
The gateway checks that version before and after reading and before recording.
Retries are bounded; failures remain errors, never clear results.

The workflow handles at most ten documents per run and runs roughly every fifteen
minutes (GitHub may delay schedules). Temporary evidence is removed after each
job. No evidence artifacts, public links or findings are printed to workflow logs.
Public-repository GitHub standard runners are the intended free execution path.
Account-wide provider limits still apply; no paid plan is required by this code.

The upstream analyzer detects structural edits. It misses cleanly fabricated
files and flattened image manipulation. Textless pages are always manual review.
The seven-file synthetic evaluation caught three structure-preserving alterations,
flagged neither of two unchanged controls, and missed two adversarial cases.
This is not an accuracy benchmark. Payroll-source verification remains necessary.

Deployment order: validate SQL against an isolated PostgreSQL fixture; record and
apply the additive migration; deploy the gateway with verify_jwt=false (it validates
GitHub OIDC itself); run authorization denials; merge the workflow/UI; execute a
synthetic upload/queue/worker/result round trip. Do not report live completion
until that round trip and frontend deployment are verified.

Upstream source: https://github.com/jjrboucher/PDF-Forensics
Vendored Application source with its Apache 2.0 LICENSE and NOTICE. Native runtime
dependencies retain their respective licenses; review distribution obligations
before releasing a derivative scanner. No customer evidence belongs in this folder.
