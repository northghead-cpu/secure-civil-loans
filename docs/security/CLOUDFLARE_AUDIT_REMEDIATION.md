# Cloudflare audit remediation — 24 October 2026

Scope: Riverbanc marketplace, northghead-cpu/secure-civil-loans, based on main
523cfd7a662c1292041415bac7b146dbc71b1bda. These changes address source-backed
leads from the audit. They do not constitute an OWASP certification or a completed
production penetration test. No production configuration or deployment is changed
by this PR.

## Disposition of the 13 audit leads

| Audit lead | Disposition |
| --- | --- |
| Aikido numeric IDs collapse in deduplication | Hash canonical signed event content, preserving identifier types and ignoring delivery timestamp. Test numeric IDs and reordered retries. Live provider contract still needs validation. |
| Stale KYC evidence can receive a decision | Server-owned revision changes on every profile update; review locks the row and requires the displayed revision and IN_REVIEW status. Old unbound review API execution is revoked. |
| Legacy broad notification INSERT policy | Not present in the deployed catalog. Harden notifications to server-only insertion and revoke browser INSERT/DELETE; restrictive policy also resists an accidental INSERT regrant. |
| Third-party OAuth tokens can mutate data | Require absence of client_id for authenticated table/storage mutations and checked definer workflows. OIDC scopes alone do not constrain database APIs. Own reads remain available under existing RLS. |
| Legacy broad profile UPDATE policies | Not present in the deployed catalog. Add restrictive owner/admin authority checks against future permissive legacy policies. |
| Receipt PDF unsupported characters abort batch | Display-only font fallback retains original stored names; isolate failures per receipt, record bounded retries, continue other receipts, and retain one email idempotency key per receipt. |
| Payment-receipt storage lacks staff MFA | Restrictive storage policy requires privileged sessions to have aal2. |
| Shared RLS reference cache crosses callers | Remove shared caching for catalogue/comparison; check active account before any GET result, including static reference cache. Responses are private/no-store. |
| Chat draft survives account switch | Remount all chat state on user identity change, including signed-out transitions. |
| Spreadsheet formula injection in CSV | Shared serializer protects formula/control prefixes, quotes values and doubles embedded quotes in both admin exports. |
| KYC document storage lacks staff MFA | Same restrictive storage guard; borrower document permissions remain governed by existing policies. |
| Support staff access and definer RPCs lack MFA | Restrictive support policies and explicit active, first-party, privileged-MFA guards at trusted function entry points. |
| Legacy public role helper enables inactive role writes | Reported public helpers absent in deployed catalog. Restrictive role mutation guards require an active account while preserving own-role SELECT for session bootstrap. |

The rejected legacy loan-status lead requires no change. Catalog checks read schema
metadata only. Tests use synthetic users and a disposable local database.

## Data preservation and compatibility

No tables, customer rows, documents or historical evidence are deleted. The new
profile revision column is additive; policy/privilege restrictions are intentional.
All profile changes invalidate a pending reviewer snapshot, so an unrelated profile
edit can require the reviewer to refresh. Unsupported PDF characters display as `?`;
the original value remains in the account record. CSV formula-like values acquire
a leading apostrophe in the export.

OAuth clients become read-only for current public tables and storage.objects.
Future tables and SECURITY DEFINER mutators must receive the same guards explicitly.
Existing non-interactive workflows must use their intended trusted server identity,
not an end-user OAuth token. Privileged first-party workflows now require MFA.

## Release sequence

1. Review and merge this PR. Coordinate a brief staff KYC review pause.
2. Apply `20261024064302_cloudflare_audit_remediation.sql` before releasing the new
   frontend. The old three-argument review RPC is deliberately disabled, so old
   frontend review attempts fail during this window. UUID default population and
   policy changes can briefly lock tables; schedule the migration accordingly.
3. Release the frontend immediately after the migration. Refresh staff browser
   sessions, complete MFA and confirm fresh/stale KYC review behavior.
4. Deploy `reference-data` with its existing JWT verification setting enabled.
5. Deploy `aikido-incident-webhook`, including `_shared/aikido-event-key.ts`, retaining
   existing own-HMAC authentication and existing gateway configuration.
6. Deploy `process-monthly-payroll-receipts` with index/email/pdf/safety modules,
   retaining its existing secret-based authentication and gateway configuration.
7. Deploy the regenerated `mcp` function with its existing authentication and
   gateway settings; its tool schemas now import patched Zod 4.6.6.
8. Verify the hosted flows below before declaring the rollout complete.

Do not revert only the frontend while leaving the new review contract unexplained.
Any rollback must preserve the revision-bound approval invariant; do not regrant
unbound approval access as a convenience. This PR does not authorize a new live
migration or deployment through the approval previously given for PR61.

## Verification

- Application suite: 32 files, 176 tests passed.
- Disposable PostgreSQL: original UI workflow tests and new security regressions
  passed. Coverage includes stale/fresh reviews, broad legacy-policy adversaries,
  notification forgery, OAuth read versus mutation, staff MFA on support/storage,
  legitimate borrower support, and suspended role writers.
- Native Deno: real pdf-lib Unicode receipt generation and reference-data handler
  account/cache isolation tests passed (two tests). Runtime network access is denied;
  the handler test intercepts outbound fetches using synthetic responses.
- TypeScript, lint and production build passed; lint retains existing warnings.
- CI includes the database, application and new native Edge regressions. Test-only
  Edge dependencies are isolated and pinned by package-lock.json.

Still required after deployment: hosted schema migration validation, real staff MFA
and KYC/document/support flows, third-party OAuth read-only behavior, provider-signed
webhook retry contract, receipt retry observability and authenticated browser checks.
The isolated fixture is not a complete recreation of hosted Supabase internals.
Real PDF generation is tested; the receipt secret-auth adapter and email provider
are not exercised end-to-end. Existing platform advisor findings, including leaked
password protection configuration, remain separate operational follow-up items.

## Dependency gate follow-up

GitHub CI additionally identified GHSA-27r3-jxmh-p828 (body-parser) and
GHSA-mrhx-c7xc-m3w5 (Zod) in the existing dependency tree. Pin body-parser
2.4.0 and Zod 4.6.6, including transitive overrides, rather than suppressing
the advisories. The Zod upgrade passes the application suite and explicit
marketplace MCP input/JSON-schema compatibility tests. Regenerate the MCP
Edge entrypoint so it uses the same patched schema library.

Bun's lock changes are targeted; the npm lockfile also reconciles older drift
against the existing package.json (including prior Sentry, router and build-tool
updates). CI uses the frozen Bun lockfile. The production dependency gate
continues to retain only its existing dev-only braces exclusion; no new
advisory is ignored. Local production audit exits successfully after the update.
