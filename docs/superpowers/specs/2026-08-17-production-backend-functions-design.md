# Production Backend Functions Design

## Goal
Make `crb-proxy` and `process-loan` production-capable without changing Riverbanc's product role, UI/UX, or existing security architecture.

## Scope
- Keep both Edge Functions as production capabilities.
- Remove mock/random/simulated provider behavior.
- Wire `crb-proxy` to the real CRB provider contract/configuration.
- Wire `process-loan` to the real Riverbanc underwriting/application workflow while preserving Riverbanc as a comparison and qualification marketplace, not a lender.
- Preserve existing authentication, RBAC, RLS, audit, masking, and database hardening.
- Deploy only after code, configuration, and invocation paths are verified.

## CRB architecture
`Admin Credit Bureau -> crb-proxy -> authenticated CRB provider -> validate/normalize -> credit_checks -> audit`

The proxy must fail closed when the provider is unavailable or configuration is missing. It must not synthesize credit scores, balances, adverse records, or recommendations.

## Underwriting architecture
`Application -> process-loan -> calculate_zmw_underwriting -> affordability/risk result -> existing application/result records -> audit`

The function may calculate affordability and risk analytics used to qualify and route applicants. It must not represent Riverbanc as the lender, originate a loan contract, or fabricate lender-side decisions.

## Security
- JWT/authentication remains mandatory.
- Role checks remain enforced server-side.
- Service-role access is limited to the server-side operation requiring it.
- No credentials reach the browser.
- Existing RLS policies and hardened RPCs remain authoritative.
- Existing handoff-secret architecture remains unchanged.

## Production configuration
Provider credentials, endpoint URLs, and integration secrets must be supplied through the appropriate production secret store. Missing configuration must produce explicit, non-sensitive errors; never fallback to mock data.

## Verification
Each function must pass:
1. Static/mock-data inspection.
2. Unit/contract tests for provider response validation and failure handling.
3. Auth/RBAC verification.
4. Database/RLS verification.
5. Production configuration verification without exposing secret values.
6. Successful deployment.
7. Real invocation-path verification using a safe production-compatible test request/provider sandbox where applicable.
8. CI/build verification.
9. Regression verification against Phase 1/2 work.

## Non-goals
- No UI redesign.
- No removal of either function.
- No change to Riverbanc's business model.
- No fabrication of unavailable third-party credentials or API responses.
