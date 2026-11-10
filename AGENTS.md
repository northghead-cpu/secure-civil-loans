
- Client session caps live in src/lib/sessionPolicy.ts (pure, tested) and are defence in depth only; server-side session timebox/inactivity must be set in Auth settings — why: localStorage cannot enforce security.
- Scope: "Riverbanc" means this Marketplace application and its Supabase project `zdpeaxkormwjrgllwalq`. Handshake is a separate application; only change it when the user explicitly names Handshake.
