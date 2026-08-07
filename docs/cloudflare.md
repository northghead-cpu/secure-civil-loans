# Cloudflare Deployment Guide — Riverbanc

Reference configuration for putting Riverbanc behind Cloudflare (proxied
custom domain, or Cloudflare Pages/CDN in front of the Lovable origin).
Nothing here changes application behaviour — it is edge configuration plus
the origin `Cache-Control` contract already shipped in `public/_headers`
and `vercel.json`.

---

## 1. Cache contract (origin → edge)

| Path | Cache-Control | Rationale |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | Vite content-hashes filenames; a changed file gets a new URL. |
| `*.woff2`, `*.woff`, `*.ttf`, `*.otf` | `public, max-age=31536000, immutable` | Fonts never change in place. |
| `*.svg`, `*.png`, `*.jpg`, `*.webp`, `*.avif`, `*.ico` | `public, max-age=604800` | Unhashed media; one-week TTL. |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | `public, max-age=3600` | SEO edits must go live quickly. |
| `/`, `/index.html` | `no-cache, must-revalidate` | A stale shell pins users to deleted bundles after deploy. |
| `/profile`, `/apply`, `/underwriting`, `/application-submitted`, `/admin/*`, `/login`, `/forgot-password`, `/reset-password` | `no-store, no-cache, must-revalidate, private` + `Pragma: no-cache` | Authenticated surfaces — never retained by any intermediary. |
| Supabase REST / Edge Function calls (`*.supabase.co`) | not proxied | Separate origin; never cached at the Riverbanc edge. |

### Cloudflare Cache Rules

Create these in **Caching → Cache Rules**, in this order (first match wins):

1. **Bypass authenticated + API paths**
   - When: `http.request.uri.path in {"/profile" "/apply" "/underwriting" "/application-submitted" "/login" "/forgot-password" "/reset-password"} or starts_with(http.request.uri.path, "/admin") or starts_with(http.request.uri.path, "/api") or starts_with(http.request.uri.path, "/functions/v1")`
   - Then: **Bypass cache**. Also disable Cloudflare's "Cache Everything" for these paths.
2. **Immutable build output**
   - When: `starts_with(http.request.uri.path, "/assets/")`
   - Then: Eligible for cache · Edge TTL **1 year** (respect origin off) · Browser TTL: respect origin.
3. **Static media & fonts**
   - When: `http.request.uri.path matches "\\.(woff2?|ttf|otf|svg|png|jpe?g|webp|avif|ico)$"`
   - Then: Eligible for cache · Edge TTL **7 days**.
4. **SPA shell**
   - When: `http.request.uri.path eq "/" or http.request.uri.path eq "/index.html"`
   - Then: Eligible for cache · Edge TTL **30 seconds** · Browser TTL: respect origin (`no-cache`), so clients always revalidate.
5. **Crawler files** — `/robots.txt`, `/sitemap.xml`, `/llms.txt` · Edge TTL **1 hour**.

**Never enable** "Cache Everything" sitewide without rule 1 in place: it would
cache authenticated HTML responses at the edge.

**Purge on deploy:** hashed assets need no purge. Purge only `/`,
`/index.html`, `/sitemap.xml`, `/robots.txt` after a release, or use a
single-file purge list rather than "Purge Everything".

---

## 2. Compression, HTTP/3, TLS

Riverbanc's output is static + JSON, so all of this is edge-side toggles —
no code change:

- **Brotli**: Speed → Optimization → Content Optimization → enable **Brotli**.
  Cloudflare negotiates `br` when the client sends `Accept-Encoding: br` and
  falls back to gzip otherwise. The origin's `Content-Type` headers are already
  correct, so text/JS/CSS/JSON/SVG all compress.
  - Do **not** enable Auto Minify (deprecated, and Vite already minifies —
    double-processing can break sourcemap-free bundles).
- **HTTP/3 (QUIC)**: Network → enable **HTTP/3** and **0-RTT Connection
  Resumption**. Safe here: 0-RTT only replays idempotent GETs, and all
  authenticated mutations go directly to Supabase over a separate origin.
- **HTTP/2 + HTTP/2 to Origin**: leave enabled.
- **TLS**: SSL/TLS mode **Full (strict)**. Minimum TLS version **1.2**
  (1.3 preferred). Enable **Always Use HTTPS**, **Automatic HTTPS Rewrites**,
  and **HSTS** (max-age 63072000, includeSubDomains, preload) — this matches
  the origin `Strict-Transport-Security` header exactly, so no conflict.
- **Early Hints**: safe to enable (works with the immutable `/assets/*` rule).
- **Rocket Loader**: leave **off**. It defers/rewrites script tags and breaks
  the CSP contract (`script-src 'self' 'unsafe-inline'`).

---

## 3. Security headers at the edge

The origin already sends CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, COOP/CORP/COEP,
`X-Permitted-Cross-Domain-Policies`, and `Origin-Agent-Cluster`
(see `public/_headers`). At the edge:

- Add a **Transform Rule → Modify Response Header** only for headers you want
  guaranteed even on Cloudflare-generated error pages (1xxx pages bypass the
  origin): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- **Do not** duplicate `Content-Security-Policy` at the edge. Two CSP headers
  are intersected by browsers and the stricter combination will break the app.
- **Remove** any server-identifying headers Cloudflare or the origin adds
  (`Server`, `X-Powered-By`) via Transform Rules → Remove.
- Managed Transforms: enable **Remove "X-Powered-By" headers** and
  **Add security headers** only if it does not re-add a CSP.

### Cookie posture

Riverbanc stores its Supabase session in `localStorage`, not cookies
(`src/integrations/supabase/client.ts`), so there is no first-party auth cookie
to flag. If cookie-based sessions are ever introduced, they must be set
`Secure; HttpOnly; SameSite=Lax` (or `Strict` for admin surfaces) at the
origin — Cloudflare cannot add `HttpOnly` to an origin cookie safely.

---

## 4. WAF — recommended settings

**Managed rulesets** (Security → WAF → Managed rules):

- **Cloudflare Managed Ruleset** — deploy, action *Managed Challenge*.
- **Cloudflare OWASP Core Ruleset** — deploy at **Paranoia level: Low/PL2**,
  score threshold *Medium (40)*. Start in **Log** mode for 48 h, review
  Security Events for false positives on `/apply` (payslip uploads) and
  `/admin/*`, then switch to *Block*.
- **Leaked Credentials Detection** — enable; it flags credential-stuffing
  attempts against `/login`.
- **Sensitive Data Detection** — enable, and add a custom detection for the
  Zambian NRC pattern (`\d{6}/\d{2}/\d`) so NRC exposure in responses is logged.

**Custom rules:**

| # | Purpose | Expression | Action |
| --- | --- | --- | --- |
| 1 | Block non-standard methods | `not http.request.method in {"GET" "HEAD" "POST" "OPTIONS"}` | Block |
| 2 | Geo-scope admin | `starts_with(http.request.uri.path, "/admin") and ip.geoip.country ne "ZM"` | Managed Challenge |
| 3 | Challenge bot traffic on auth | `http.request.uri.path in {"/login" "/forgot-password" "/reset-password"} and cf.bot_management.score lt 30` | Managed Challenge |
| 4 | Block known-bad ASNs / Tor on write paths | `(ip.geoip.asnum in {…} or cf.tor_exit_node) and http.request.method eq "POST"` | Block |
| 5 | Block oversized uploads | `http.request.body.size gt 10485760` | Block |

**Bot Management / Super Bot Fight Mode:** block *definitely automated*,
managed-challenge *likely automated*, allow verified bots (Googlebot,
Bingbot — required for the SEO setup and sitemap fetches).

**Scrape Shield:** enable Email Address Obfuscation; leave Hotlink Protection
off (it interferes with `og:image` fetches by social crawlers).

---

## 5. Rate limiting — recommended rules

Application-level throttling already exists client-side
(`src/lib/authThrottle.ts`, 5 attempts / 15 min with progressive lockout) and
server-side for edge functions (`edge_request_log`). Cloudflare rules below add
the network-layer tier that an attacker cannot skip by calling the API directly.

| Rule | Match | Limit | Period | Action / duration |
| --- | --- | --- | --- | --- |
| Login brute force | `http.request.uri.path eq "/login" and http.request.method eq "POST"` | 5 | 60 s | Block 15 min, counted per IP |
| Password reset | `http.request.uri.path in {"/forgot-password" "/reset-password"}` | 3 | 60 s | Managed Challenge, 10 min |
| Supabase auth endpoints (if proxied) | `starts_with(http.request.uri.path, "/auth/v1")` | 10 | 60 s | Block 10 min |
| Edge functions | `starts_with(http.request.uri.path, "/functions/v1")` | 30 | 60 s | Block 5 min |
| KYC / document upload | `http.request.uri.path eq "/apply" and http.request.method eq "POST"` | 10 | 300 s | Managed Challenge |
| Admin surface | `starts_with(http.request.uri.path, "/admin")` | 300 | 60 s | Log then Block |
| Global per-IP ceiling | `not starts_with(http.request.uri.path, "/assets/")` | 600 | 60 s | Managed Challenge |

Counting characteristics: use **IP** plus, where available, the
`cf-connecting-ip` + `User-Agent` pair. Exclude `/assets/*` from every
rate-limit rule so a cold cache on a slow connection never trips a limit.

---

## 6. Compliance note (proxied custom domains)

Lovable-managed custom domains in proxy mode still terminate on Cloudflare's
network, so cookie scanners and compliance tooling may report the Cloudflare
edge POP that served the scan rather than the Zambian origin region. If
scanner attribution must stay region-specific, run a customer-managed CDN or
reverse proxy in front of Lovable and manage TLS and regional routing there.

---

## 7. Post-deploy verification checklist

```bash
# Immutable asset headers
curl -sI https://riverbanc.lovable.app/assets/<hashed>.js | grep -i 'cache-control\|cf-cache-status\|content-encoding'

# Shell must revalidate
curl -sI https://riverbanc.lovable.app/ | grep -i 'cache-control'

# Authenticated route must not be cached
curl -sI https://riverbanc.lovable.app/admin | grep -i 'cache-control\|cf-cache-status'   # expect no-store / DYNAMIC

# Brotli negotiated
curl -sI -H 'Accept-Encoding: br' https://riverbanc.lovable.app/ | grep -i content-encoding

# HTTP/3
curl -sI --http3 https://riverbanc.lovable.app/ | head -1

# Exactly one CSP header
curl -sI https://riverbanc.lovable.app/ | grep -ci content-security-policy   # expect 1
```
