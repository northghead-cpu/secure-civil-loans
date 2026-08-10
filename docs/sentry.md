# Sentry error monitoring

Riverbanc uses `@sentry/react` for browser error monitoring, performance
tracing, and on-error session replay. The integration is **privacy-first and
disabled by default**: with no DSN configured, `initSentry()` is a no-op and
the app behaves exactly as before.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | yes (to enable) | Sentry DSN. Publishable value — safe in the client bundle. Leave unset to disable monitoring. |
| `VITE_SENTRY_ENVIRONMENT` | no | Environment tag. Defaults to `production` in prod builds, `development` otherwise. |
| `VITE_SENTRY_RELEASE` | no | Release tag (commit SHA or version) used to group regressions and match source maps. |
| `SENTRY_UPLOAD_SOURCEMAPS` | no | Build-time only. Set to `true` to emit hidden source maps for upload. |

`VITE_*` values are inlined at build time by Vite, so they must be present in
the build environment (project `.env` for local work, hosting env vars for
deploys).

## What Sentry never receives

Infratel is the sole store of customer PII. Sentry sits outside that boundary,
so the SDK is configured to deny by default:

- `sendDefaultPii: false` — no IP address, no cookies, no user identity.
- `beforeSend` deletes `event.user`, `request.data` (HTTP bodies),
  `request.headers`, `request.cookies`, and `request.query_string`.
- Every event, transaction, span, and breadcrumb passes through `scrubDeep`,
  which redacts keys matching NRC, employee number, payslip/payroll, salary,
  KYC, CRB, loan application, document/file, token/JWT/secret, email, phone,
  and name patterns — plus value-shape matching for Zambian NRCs, Zambian
  mobile numbers, JWTs, Supabase auth-token storage keys, emails, and inline
  `data:...;base64` document payloads.
- URLs are stripped of `access_token`, `refresh_token`, `code`, `email`, `nrc`
  and similar params, and the hash fragment is dropped entirely (Supabase
  recovery tokens arrive in the hash).
- Console and `ui.input` breadcrumbs are dropped outright; DOM breadcrumbs
  serialize no attributes.
- Session replay: `maskAllText`, `maskAllInputs`, `blockAllMedia`, no network
  bodies or headers recorded.

Regression coverage lives in `src/lib/__tests__/sentry.test.ts`. Do not relax
any of these flags without a DPIA review.

## Sampling

| Setting | Production | Non-production |
| --- | --- | --- |
| `sampleRate` (errors) | 1.0 | 1.0 |
| `tracesSampleRate` | 0.1 | 1.0 |
| `replaysSessionSampleRate` | 0 | 0 |
| `replaysOnErrorSampleRate` | 0.1 | 0 |

Healthy sessions are never replayed; replay only triggers on errors, and only
for 10% of them in production.

## Source maps

`sourcemap: false` by default, so no maps are served publicly. To get readable
stack traces, build with maps generated but not referenced from the bundles:

```bash
SENTRY_UPLOAD_SOURCEMAPS=true bun run build          # emits hidden .map files
bunx @sentry/cli sourcemaps inject ./dist
bunx @sentry/cli sourcemaps upload ./dist \
  --org <org> --project <project> --release "$VITE_SENTRY_RELEASE"
rm -f dist/assets/*.map                              # never deploy the maps
```

`SENTRY_AUTH_TOKEN` is a server-side secret used only by the CLI in CI. Never
expose it with a `VITE_` prefix.

## Content Security Policy

`connect-src` allows `https://*.ingest.sentry.io` and
`https://*.ingest.de.sentry.io` in `public/_headers`, `vercel.json`, and the
dev-server headers in `vite.config.ts`. If your DSN uses a different ingest
host, add it there.

## Development test panel

`src/components/dev/SentryTestPanel.tsx` renders a floating panel with two
buttons (captured error with fake sensitive payload, and an unhandled throw).
It is dynamically imported behind a `!import.meta.env.PROD` guard in
`src/App.tsx`, so it is never bundled into or reachable from production.
