# Riverbanc public SEO + search branding patch

## Audit results (verified this turn)

- **`https://www.riverbanc.co.zm/` is not configured.** The project has only the preview URL and the published `https://riverbanc.lovable.app`; no custom domain is attached. Flagging rather than guessing — I will keep `https://riverbanc.lovable.app` as the canonical host until the domain is connected and verified in Project Settings → Domains.
- **`index.html`** already carries the requested title, description, OG title/description, `og:type`, `og:site_name`, `twitter:card`, `theme-color`, canonical, `og:url`, and Organization + WebSite JSON-LD. No `@Lovable` handle and no R2/Lovable preview image remain. What is missing: any `<link rel="icon">` / apple-touch-icon / manifest reference, and `twitter:url`.
- **`public/favicon.ico`** is the stock Lovable icon (20 KB) and is still what browsers fetch by default.
- **No Riverbanc logo exists in the project** — `src/config/logo.ts` points at `/logo.png`, which is not in `public/`; `src/assets` holds only `hero-bg.jpg`. **No user upload is mounted this turn**, so the supplied logo is not accessible to me.
- **`public/robots.txt`** — production domain in the `Sitemap:` directive, marketing pages allowed, private routes (`/admin`, `/profile`, `/apply`, `/underwriting`, `/application-submitted`) disallowed. Correct as-is.
- **`public/sitemap.xml`** — 5 URLs on the production domain. One issue: `/login` is listed; an auth page has no search value.
- **`public/llms.txt`** — already on the approved description, no Lovable branding.
- **Per-route Helmet canonicals** (`ComparePage`, `PrivacyPolicy`, `RetentionPolicy`) — already on the production domain, self-referencing correctly.

## The smallest safe patch

1. **`public/sitemap.xml`** — remove the `/login` entry (leaves `/`, `/compare`, `/privacy-policy`, `/retention-policy`).
2. **`index.html`** — add the explicit icon block and `twitter:url`:
   - `<link rel="icon" href="/favicon.ico" type="image/x-icon">` placeholder now, repointed to the Riverbanc PNG the moment the logo lands.
   - `<meta name="twitter:url" content="https://riverbanc.lovable.app/">` for consistency with `og:url`.
   - No JSON-LD changes: the existing Organization/WebSite blocks contain only verified facts (name, legalName, url, description, `areaServed: "ZM"`). No registration number, address, phone, or social profile will be invented.

## Blocked on the logo asset (not substituted)

These stay open until the logo file is re-attached and visible in the mount:

- 16/32/48 favicon PNGs + `favicon.ico`, 180 Apple touch icon, 192/512 app icons
- `public/manifest.webmanifest` and its `<link rel="manifest">`
- 1200×630 Riverbanc `og:image` / `twitter:image`

I will not design, generate, or borrow a stand-in logo. Once the file is available, that becomes a second, equally narrow pass: generate icons from the official artwork, delete `public/favicon.ico`, and point the tags at the new files.

## Out of scope

No dependencies, no database or RLS changes, no auth/underwriting/admin/business-logic edits, no changes to `public/_headers`, `vercel.json`, or `package.json` metadata.

## Domain switch, on request

When `www.riverbanc.co.zm` is verified, one follow-up pass swaps the host in `index.html` (canonical, `og:url`, `twitter:url`, both JSON-LD `url` fields), `public/sitemap.xml`, `public/robots.txt`, and the three Helmet route heads.
