# Public company profile

Permanent QR destination: https://www.riverbanc.co.zm/partnership-profile/

The approved 27-page PDF is stored at `public/partnership-profile/riverbanc-company-profile.pdf`. It is an unchanged copy of the uploaded July 2026 company profile. SHA-256: `45f035b3bcb2681b83387bf13553330894b9a27aeeb79aa8e33cd3b867654578`.

Vercel rewrites and Cloudflare `_redirects` serve PDF bytes for `/partnership-profile`, `/partnership-profile/` and `/partnership-profile/index.html`. There must be no static `index.html` in this directory: Vercel serves that file before applying rewrites, which would return HTML with PDF headers. The deployment host must apply the supplied routing rules. The marketplace React app is not involved. No database changes are required.

`public/riverbanc-company-profile-qr.png` and `.svg` encode only the permanent address. They have a white background, Riverbanc navy modules and a four-module quiet zone. Keep this space clear. Recommended caption: "Scan to view our company profile"; include the permanent URL below it. Test a printed proof before printing in quantity.

## Verification

Build with `npm ci` and `npm run build`. After preview deployment, run:

```sh
node scripts/check-company-profile.mjs https://preview-host
```

Repeat against production after release. This checks all URL variants, approved bytes, inline display headers, cache revalidation and the normal HTML response for home, compare and login. Also scan from Android/iPhone and inspect browser rendering before printing QR materials. Native PDF viewing behavior depends on the browser; downloading remains available.

## Implementation checks completed

- Production build passed.
- Source, public asset and build-output PDF bytes match.
- Local Cloudflare runtime passed all five PDF GET/HEAD URL cases plus home, compare and login HTML checks.
- Independent ZXing decoder read the QR destination correctly at 720, 360 and 180 pixels.
- Vercel preview and production checks remain pending publication and deployment.

## Updating the profile

Replace only the PDF with the next approved complete document, rebuild and deploy. Keep its path and the permanent QR URL unchanged. Confirm its new page count and SHA-256 and update this record. The cache policy forces revalidation so future scans receive the current version. Existing printed QR codes remain valid.

## Rollback

Revert this feature commit and redeploy the previous build to restore the previous summary page. This requires no data rollback.
