
- Client session caps live in src/lib/sessionPolicy.ts (pure, tested) and are defence in depth only; server-side session timebox/inactivity must be set in Auth settings — why: localStorage cannot enforce security.
