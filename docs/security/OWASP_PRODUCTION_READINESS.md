# Riverbanc marketplace security review

Review date: 22 October 2026 (Africa/Lusaka). Repository: `northghead-cpu/secure-civil-loans`. Baseline: `16fb813075b6b6c444f74b3e74298ad6b44eed3c`. Supabase project: `zdpeaxkormwjrgllwalq`. Handshake Suite is outside this review.

**Release decision: HOLD.** This is a source/configuration review with targeted tests, not a completed penetration test, certification, or a claim of ASVS Level 2 compliance. Use OWASP ASVS 5.0.0 Level 2 as the target and record individual applicable requirement evidence before sign-off. Untested controls remain unverified, rather than passed.

## Findings and changes

| Finding | Evidence and impact | Change / remaining evidence |
|---|---|---|
| High: privileged Edge operations omitted MFA | `process-loan` uses service-role reads/writes after an admin role lookup without checking AAL. `crb-proxy` and reference-data invalidation can read the caller's own bootstrap role at AAL1. Database MFA policies cannot enforce operations performed through a service-role client. | Shared authorization remotely validates the bearer, binds its subject to the returned user, requires AAL2, then checks current database admin/super_admin membership. Used by underwriting, CRB, exports and cache invalidation. Unit tests cover forged claims, missing MFA, metadata escalation and backend failures. Deployment and real-token HTTP negative/positive tests remain required. |
| High: clients could write trusted outputs | Live catalog confirmed authenticated INSERT/UPDATE grants on `loan_results`, `underwriting_queue`, and legacy `kyc`. Owner policies permit creation of client-supplied result/queue records; legacy KYC owner writes can supply verification state. | Migration revokes client INSERT/UPDATE/DELETE and removes obsolete result/KYC write policies. Current frontend only reads these legacy/output tables; actual KYC submission uses `kyc_documents`. Service-role workflow remains the writer. Migration validation/application is pending. |
| Reporting authorization called an unavailable RPC | The live public-function inventory has no `public.has_role`; exports invoked that RPC twice. | Exports use the shared database-role check instead. Verify a real AAL2 export after deployment. |
| Medium: deep telemetry objects bypassed scrubbing | `scrubDeep` returned the original value after depth 8, allowing nested data to leave unsanitized. | Excess depth now truncates to `[redacted]`; cyclic/deep-object regression test added. Free-form messages and replay still require an explicit privacy review. |
| High dependency advisory | Fresh Bun audit reports GHSA-587h-7wmj-h5pm against Vite 6.4.3. Advisory affects Windows editor-launch handling; it is not evidence of an exploitable static production bundle. | Upgrade the exact dependency and override to patched Vite 6.4.4 and regenerate the Bun lockfile. Rerun the audit and full checks. |
| Generated MCP issuer drift | Committed generated MCP function used a different project issuer (`amjbvphgwhtfcbbmmpzz`). Source derives issuer from build environment. | Rebuilt generated artifact uses this marketplace's project. MCP is not in the live Edge function list; verify intended exposure and issuer before deploying it. |

## Observed controls

- All 41 inspected public tables have RLS enabled. This establishes presence, not correctness of every policy.
- All three inspected storage buckets (`kyc-documents`, `payslips`, `payment-receipts`) are private, with 10 MiB size caps and PDF/JPEG/PNG MIME allowlists. MIME allowlists do not establish actual content validation or malware scanning.
- Privileged public-table policies require AAL2, with a narrow own-role read exception for MFA bootstrap.
- Profile triggers protect role, verification/account fields and previously verified identity. Authorization reads database roles rather than user-editable metadata.
- Handoff/subscription consent use authenticated RPCs, stored evidence and audit writes. Seven callable SECURITY DEFINER RPC signatures were flagged by the advisor; intentional exposure requires per-function review rather than blanket revocation.
- Credit bureau proxy fails closed while no live provider is configured.
- Hosting files define CSP, HSTS, frame denial, no-sniff and private/no-store authenticated routes. A passive HEAD request to https://www.riverbanc.co.zm returned HTTP 200 and the expected CSP, HSTS, no-sniff and frame-denial headers. Authenticated route caching remains unverified.
- Existing CI runs tests, TypeScript, lint, build, dependency audit and a limited regex secret scan. Baseline main CI run 39021960046 succeeded. This does not validate the current branch or all ASVS controls.
- Advisor INFO for RLS-with-no-policy on `receipt_delivery_events` is consistent with denying client access; do not add a permissive policy merely to clear the notice.

## Verification evidence

Final local checks with Vite 6.4.4: 25 test files / 141 tests passed, including 11 new privileged-authorization tests and a deep/cyclic telemetry test. TypeScript build check and production build passed. ESLint returned zero errors and 45 warnings before the dependency-only patch. The production dependency audit exited 0 using the repository's existing single advisory exclusion (GHSA-vfj7-8cjw-p6xm). This is not a zero-advisory claim for every development dependency.

`supabase/tests/security/authorization.sql` provides rollback-only synthetic borrower/admin checks for anonymous denial, borrower isolation, metadata/role escalation, self-verification protection, trusted-output privileges, and AAL1/AAL2 behavior. **It has not produced a completed result in this review.** A database verification attempt was interrupted; no successful migration application or rollback-test result is claimed. Confirm current grants/migration history before any deployment.

Native Edge type checking was attempted with Deno 2.9.6 but could not download esm.sh imports (connection refused). It did not complete. Current-branch CI and authenticated HTTP tests require completed results. A Deno check for all four changed privileged functions is now included in CI. Browser tests and full ASVS verification have not been completed.

## Remaining release gates

| Gate | Required proof |
|---|---|
| Deploy reviewed fixes | Passing CI on the exact reviewed commit; apply the trusted-output migration and deploy the four changed Edge functions with `_shared/privileged-auth.ts`; record versions and rerun advisor checks. No production deployment is claimed by this PR. |
| Authorization and storage | Run rollback SQL tests; real user JWTs: borrower A cannot read/change borrower B profile, application, consent, receipt or file; AAL1 staff denied; AAL2 authorized staff allowed; revoked/suspended users denied; expired signed links fail. Test RPCs, REST and Storage APIs directly. |
| Session controls | `docs/security/session-management.md` states server timebox/inactivity settings are not verified. Provide actual Auth configuration and refresh/revocation tests. Browser localStorage limits are defense in depth only. |
| Password controls | Live advisor reports leaked-password protection disabled. Prior acceptance of a plan limitation is a documented residual risk, not a passed control. Record the marketplace owner's explicit disposition and verify password length, recovery, enumeration resistance and server throttling. |
| Uploads/KYC | Validate file signatures/content, quarantine/scanning, storage ownership/path rules, retention/deletion and access auditing. Browser OCR/period extraction is untrusted evidence until a trusted reviewer/service verifies it. |
| Business workflow | Test borrower signup/recovery, KYC submission, separate subscription/sharing consents, lender selection/handoff, staff review, billing/receipts and retries with synthetic data. Avoid duplicate emails, deductions and handoffs. |
| Abuse resistance | Existing count-then-insert Edge rate limits are not atomic under concurrency; verify/enforce concurrency-safe limits. Request size checks currently read full bodies before checking actual size. Verify gateway limits or implement bounded streaming. Verify HTTP timeouts, export limits and provider retry budgets. |
| Browser/deployment | Authenticated browser smoke tests, CSP/XSS/DOM review, deployed headers/TLS, redirects, cache policy and no public source maps. CSP currently allows inline scripts and broad Supabase hosts; tighten with hashes and actual project hosts after checking required integrations. |
| Operations | Demonstrated encrypted backup restore, agreed RPO/RTO, monitoring and alert delivery, incident owner, secret rotation/revocation, dependency scanning and release rollback. A configured monitoring SDK alone is not alert-delivery proof. |
| Data location/privacy | Connected marketplace project is in `eu-central-2` and contains KYC/profile schemas and document buckets. Confirm the intended protected Zambia-hosted boundary and approved processing design before loading real borrower data. This is an architecture verification item, not a legal conclusion. |
| Repository protection | Rulesets endpoint returned an empty list. Verify classic branch protections separately and require review plus security/CI gates for main; administration access was not assumed. |

## Four-day completion order

1. **22 October:** Review/merge fixes after checks; validate migration on a disposable database; deploy and test actual AAL1/AAL2 authorization and output-write denial. Close high findings.
2. **23 October:** Complete direct API isolation, Storage and RPC negative tests, then synthetic browser workflow tests and upload validation.
3. **24 October:** Verify sessions, abuse/concurrency limits, data boundary, backup restore, alert delivery, retry/idempotency and load behavior. Review each applicable ASVS requirement with evidence.
4. **25 October:** Independent targeted penetration review and retest; release only the exact tested commit after all blocking gates close and the owner records any accepted residual risks.

## References

- https://asvs.owasp.org/ — ASVS 5.0.0 baseline.
- https://supabase.com/docs/guides/functions/auth-headers — platform JWT checks versus handler authorization.
- https://supabase.com/docs/guides/functions/auth-legacy-jwt — verified identity and user-scoped RLS clients.
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://github.com/advisories/GHSA-587h-7wmj-h5pm — Vite patched version 6.4.4.

