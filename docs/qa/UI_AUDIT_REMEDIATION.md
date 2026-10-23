# Marketplace workflow remediation

Baseline: `167b0789f1c64f99e71e839a5b0a8d1c8904c949` (secure-civil-loans).

## Result and release boundary

This change addresses the 32 UI audit findings through implemented workflows, corrected contracts/feedback, or explicit availability boundaries. It does **not** connect a payroll/CRB provider, a payment-transfer service, a generic automation executor, or email/SMS/Slack application notifications. Unsupported controls cannot report success or silently pretend those services exist.

Production has not been changed. The database migration and Edge changes must precede the new frontend release. Database testing here uses isolated PostgreSQL with synthetic fixtures; a full Supabase staging rehearsal and authenticated browser role/device testing remain release requirements. Automatic approval review rejected the proposed production rollback rehearsal because the security/schema migration has a substantial blast radius; it was replaced with isolated testing. That rejected action was not retried against production.

## Finding disposition

| Audit ID | Change | Remaining dependency |
|---|---|---|
| UX-01 | Atomic `submit_kyc_verification` records evidence, identity fields/signature and IN_REVIEW together. Borrowers cannot self-approve. | Apply migration; staging browser run. |
| UX-02 | Submission replaces/supersedes the previous evidence set transactionally; review rejection updates the document records. Retries do not hit the old unique indexes. | Same. |
| UX-03 | Review screen loads every submitted evidence record, signed document links, identity details and correction reasons. | Same; reviewer test account with MFA. |
| UX-04 | KYC success returns to the profile with a verification notice. Legacy confirmation redirects to tracking rather than asserting a nonexistent handoff. | Frontend release. |
| UX-05 | Replacing a payslip excludes its own slot from the duplicate-month check. | Regression test passes. |
| UX-06 | Government ID type/number and matching legal-name signature are persisted; verification copy separates subscription and lender authorization. | Migration. |
| UX-07 | Date-lookup failure has a durable explanation and working retry. | Regression test passes. |
| UX-08 | Profile counts/recent records, dashboard and staff queue use application_handoffs; success navigates to a particular record. Staff can record preparation and independently verified secure delivery. Legacy records remain separately accessible. Estimates are calculated server-side. | Actual institution delivery remains an operational process; no automatic lender transport is claimed. |
| UX-09 | Information-request detail, when supplied, is displayed with an application-specific support case entry and secure-response guidance. | Institution must supply the exact request; document exchange is arranged by support. |
| UX-10 | Tracking has an owned-application selector and stable `?id=` links; all records are read in pages. | Frontend release. |
| UX-11 | Authorization/selection are complete before preparation; institution decisions finish the journey. | Unit tests pass. |
| UX-12 | Removed inert security/maintenance switches; readonly configuration accurately explains separately enforced MFA/session settings and unavailable controls. | Maintenance/IP enforcement would require a separately scoped server implementation. |
| UX-13 | Removed save-only brand/notification switches. Mounted recorded borrower updates with persistent read state and real KYC/handoff events. | Email/SMS/Slack application delivery remains unconfigured. |
| UX-14 | Removed the two handlerless integration buttons; actual workbook status/sync remains in its dedicated workspace. | None for removing the dead actions. |
| UX-15 | Rules are explicitly draft definitions; the enable control cannot activate an unconnected executor. Migration disables dormant enabled definitions. | A real executor and approved trigger/action vocabulary are still required before automation can run. |
| UX-16 | Payroll registry discloses its limits; connection testing is disabled with an availability explanation. | Payroll provider API/import integration. |
| UX-17 | Own-role bootstrap and staff read policies match the permitted views; unsupported edit/export capabilities are removed, commission edits require Super Admin, risk policy uses authoritative application roles, zero-row status/commission updates cannot claim success. Staff dashboard avoids unauthorised cross-role queries. | Migration and role-by-role staging verification. |
| UX-18 | Borrowers can read their own role; the chat eligibility check can resolve it. | Migration. |
| UX-19 | Restrictive active-account policies apply to application/storage data; effective privileged roles and relevant definer RPC/Edge operations check active status; the UI observes profile changes and blocks suspended accounts. | Migration and four Edge deployments. Existing JWTs are not claimed to be revoked; data/operation access is independently denied. |
| UX-20 | Export checks every response, reads all pages, and includes current and legacy customer records, handoffs, subscriptions, receipts, notifications, support cases/messages and payout records. File references are included, not file bytes or internal staff reconciliation evidence. | Authenticated staging export validation. |
| UX-21 | Reports accurately name raw registers/configuration; date scope says all recorded dates; current profile verification is used. | No fabricated default-rate/revenue/disbursement analysis is offered. |
| UX-22 | Removed bulk mark-paid action. Payout register is readonly and explicitly states no transfer service is connected. | Payment execution/settlement workflow requires a real integration and evidence contract. |
| UX-23 | This-month total uses current UTC month; other totals remain clearly separate. | Frontend release. |
| UX-24 | Failed commission saves keep the dialog open; affected-row confirmation, numeric validation and in-flight protection are included. | Super Admin staging test. |
| UX-25 | Exact positive amount entry and every supported product term replace fixed loan-sized constraints. Switching product categories resets retained term filters. | Product inventory validation in staging. |
| UX-26 | Durable load errors/retry replace false empty states in tracking, profile, KYC, audit/history, payouts, receipts, risk and underwriting. | Failure-path browser checks. |
| UX-27 | Database search and date filtering run before pagination; older audit records are searchable and navigable. | Isolated database test passes beyond the original 500-row window. |
| UX-28 | Protected task path/query survives login; unsafe or looping return targets are rejected. | Unit tests pass. |
| UX-29 | KYC file inputs are keyboard focusable; ordinary fields have associations, and payroll/commission actions have accessible names. | Full screen-reader/mobile/WCAG evaluation remains outstanding. |
| UX-30 | New CRB inquiries are disabled with an explicit provider-unavailable message; historical records remain available. | Actual CRB provider and approved inquiry process. |
| UX-31 | Verified counters use a complete paged profile dataset rather than an unfinished-only queue. | Migration and staging data check. |
| UX-32 | About points to a real landing-page section. | Frontend release. |

Additional repair: the live handoff status constraint omitted several states that tracking already renders. The migration accepts those institution-controlled outcomes while revoking arbitrary authenticated handoff updates; only the constrained staff preparation/delivery RPC is added. Submitted evidence is immutable to borrower update/deletion; unsubmitted orphan uploads can still be cleaned up.

## Verification

- Application suite: 166 tests passing, including new KYC replacement/retry, task return, export pagination/failure, journey state and suspended-account checks.
- TypeScript build check and production Vite build pass.
- ESLint has no errors; existing warnings remain recorded in CI output.
- `npm run test:db-ui`: complete migration applies in isolated PostgreSQL; synthetic tests cover borrower isolation, role bootstrap, document ownership, atomic KYC/retry/review, self-approval denial, MFA, suspension, handoff estimates/transitions/delivery reference, lender-decision write denial and older audit search.
- Native Deno check passes with local import mappings to the same pinned Supabase 2.49.1 and Zod 3.23.8 packages. Direct esm.sh fetching is blocked in this execution environment; CI runs the unchanged remote-import check.
- No live KYC documents, passwords, approvals, support messages, payment actions or production settings were submitted.

## Repeatable checks

```sh
bun install --frozen-lockfile
bun run test
bun run test:db-ui
bun x tsc -b --noEmit
bun run lint
bun run build
```

`supabase/tests/fixtures/ui_bootstrap.sql` is a minimal schema/security unit fixture derived from read-only catalog metadata at the audit baseline. It includes only the tables/functions required for the rehearsal, substitutes Auth/storage entry points, and deliberately does not model the entire hosted platform. It is never a deployment script. Run `supabase/tests/security/ui_workflows.sql` against a disposable Supabase staging database after the migration for the hosted integration check; it creates synthetic records and ends in ROLLBACK.

## Release order

1. Review the migration, staff capability changes, unsupported-feature boundaries and this disposition table.
2. Rehearse on a disposable Supabase staging project, including all staff roles at AAL1/AAL2 and separate borrower states.
3. After production approval, apply `20261022205917_marketplace_ui_workflows.sql`; deploy process-loan, crb-proxy, reference-data and sheets-export with their shared account-status check.
4. Release the frontend from the same commit. Verify borrower submission/review/resubmission and staff handoff preparation/delivery with controlled accounts.
5. Retain the old frontend release for UI rollback. Database changes are additive except tightened grants/policies and disabled dormant rules; do not drop stored evidence/authorization records to roll back.
