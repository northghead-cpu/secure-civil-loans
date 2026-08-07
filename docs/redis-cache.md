# Upstash Redis caching (Supabase Edge Functions)

Riverbanc uses an **optional** Upstash Redis cache, called over its REST API
from Supabase Edge Functions. It is a pure performance layer: when it is not
configured, or when Upstash is unreachable, every request falls through to the
database and behaviour is identical to before.

## What is cached

| Resource | Cache key | Default TTL | Env override |
|---|---|---|---|
| Lender product catalogue | `catalogue:active` | 300s | `CACHE_TTL_CATALOGUE` |
| Public comparison results | `comparison:<amount>:<term>` | 120s | `CACHE_TTL_COMPARISON` |
| Underwriting reference data (DTI bands, term options, affordability rule) | `underwriting-reference:v1` | 900s | `CACHE_TTL_REFERENCE` |
| CRB **reference** tables (generic score bands, recommendation labels) | `crb-reference:v1` | 3600s | `CACHE_TTL_CRB_REFERENCE` |
| Expensive aggregate reads (helper TTL for future use) | caller-defined | 60s | `CACHE_TTL_AGGREGATE` |

## What is never cached

- Authenticated sessions, JWTs, refresh tokens
- Any PII (names, NRC numbers, phone numbers, employer/employee identifiers)
- KYC documents, OCR output, payslip data
- Customer-specific financial data (applications, payouts, salaries)
- Per-borrower CRB inquiry results — `crb-proxy` remains uncached by design;
  only the generic score-band reference table is cached.

Authorization is always evaluated per request against the database (JWT claims
+ `user_roles`), never served from cache.

## Environment variables

Add these in **Project Settings → Secrets** (they are read by the edge
functions at runtime). The cache is enabled only when **both** of the first two
are present.

| Name | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | yes (to enable) | REST endpoint, e.g. `https://eu1-xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | yes (to enable) | Upstash REST token (use a read/write token) |
| `CACHE_NAMESPACE` | no | Key prefix so envs can share one DB. Default `riverbanc:dev`. Use `riverbanc:prod` in production. |
| `CACHE_TTL_*` | no | Per-resource TTL seconds (table above) |
| `CACHE_MAX_ATTEMPTS` | no | Retry attempts per command. Default `3` |
| `CACHE_TIMEOUT_MS` | no | Per-attempt timeout. Default `1500` |

## Deployment steps

1. Create a Redis database at [console.upstash.com](https://console.upstash.com)
   in the region closest to the Supabase project. Enable **TLS** (default) and
   **Eviction** (`allkeys-lru`) — all entries here are disposable.
2. Copy the **REST URL** and **REST token** from the database's *REST API* tab.
3. Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and
   `CACHE_NAMESPACE` in Project Settings → Secrets.
4. Redeploy/redeploy-on-save the edge functions (`reference-data`). No
   migration or client change is required.
5. Verify: call the function and inspect the `X-Cache` response header —
   `DISABLED` (no env vars), `MISS` (first read), `HIT` (subsequent read).

To disable the cache, remove the two Upstash secrets. Nothing else changes.

## Reliability behaviour

- **Fail-open**: network errors, timeouts and 5xx responses are retried with
  exponential backoff (100ms → 200ms → 400ms), then treated as a cache miss.
- **No retry on 4xx**: an auth or command error is logged once and skipped.
- **Timeouts**: each attempt is aborted after `CACHE_TIMEOUT_MS`, so a hung
  Upstash instance cannot slow a request beyond ~4.5s worst case.
- **No secret logging**: only status codes and generic messages are logged.

## Invalidation

Writes purge the affected keys immediately; TTL expiry is the backstop.

- Admin product writes (`adminProductService.create/update/toggleStatus`) call
  `referenceDataService.invalidate()`, which POSTs
  `{ action: "invalidate" }` to `reference-data`.
- Scoped purge: `invalidate("catalogue")` clears only that resource.
- Invalidation requires an `admin` or `super_admin` role; it uses `SCAN` +
  `DEL` within the configured namespace, so other environments are untouched.

## Client usage

```ts
import { referenceDataService } from "@/services/referenceDataService";

const catalogue = await referenceDataService.getCatalogue();
const offers = await referenceDataService.getComparison(100_000, 60);
```

## Cloudflare interaction

The edge cache is complementary to the Cloudflare rules in
[`docs/cloudflare.md`](./cloudflare.md). Responses from `reference-data` are
returned with `Cache-Control: private, max-age=30`, so Cloudflare will not
store them at the CDN edge — Redis is the shared cache, Cloudflare remains
responsible for static assets only. Do not add a Cloudflare Cache Rule for
`/functions/v1/*`.
