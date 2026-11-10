# Dependency Advisory Exceptions

## GHSA-qwww-vcr4-c8h2 — React Router RSC CSRF

**Status:** Accepted as non-applicable to the current Riverbanc application architecture.

**Reviewed:** 2026-08-11

**Advisory:** React Router RSC CSRF vulnerability (GHSA-qwww-vcr4-c8h2).

### Applicability assessment

The advisory affects applications using React Router's unstable RSC APIs. The Riverbanc frontend currently uses the standard client-side routing model (`BrowserRouter`, `Routes`, and `Route`) and does not use React Router RSC APIs.

The dependency remains subject to normal dependency monitoring. This exception does **not** authorize disabling general dependency auditing or ignoring other React Router advisories.

### Required conditions

This exception is valid only while all of the following remain true:

1. Riverbanc does not enable React Router RSC APIs.
2. Riverbanc does not introduce an RSC server/runtime that uses the affected React Router functionality.
3. A future React Router upgrade or architecture change triggers a fresh applicability review.

### Review trigger

Immediately reassess this exception if the application introduces RSC functionality, changes its routing/server architecture, or if the advisory scope changes.
