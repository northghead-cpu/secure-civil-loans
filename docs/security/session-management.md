# Session management

## Client-side (defence in depth only, NOT server-enforced)
`src/lib/sessionPolicy.ts` + `src/hooks/useIdleTimeout.ts`:
- Idle limit 30 min, measured from the last genuine interaction (keyboard, mouse, touch, scroll). Mounting, focus or wake never resets it.
- Absolute limit 12 h, anchored to the Auth server's `last_sign_in_at` (token refresh does not move it).
- Checks run on mount, focus, visibility return, pageshow (bfcache), online, and every 30 s.
- Missing, non-numeric, future-dated or previous-login activity values sign the user out, unless the login is under 5 minutes old (first-login initialisation).
- Sign-out always uses `scope: "local"` (revokes this session's refresh token on the server), broadcasts to other tabs once (no loops), and redirects to `/login` unless already there.

Because these timestamps live in the browser, a user can tamper with them for their own session. They do not protect against a stolen refresh token.

## Server-side (required, dashboard-only — not verified from code)
Set these under Cloud → Users → Auth settings → Sessions (Pro-tier feature):
- Time-box user sessions: 12 hours
- Inactivity timeout: 30 minutes
- Optional: Single session per user
- JWT expiry: 3600 s or less

Until they are set, the server accepts a valid refresh token indefinitely.

## Authorization boundaries
Protected routes are UX only. Data access is enforced by RLS (`auth.uid()`, `has_role`) and by edge functions validating the bearer with `getUser()`. Neither relies on the client timeout.
