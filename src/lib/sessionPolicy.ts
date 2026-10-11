/**
 * Client-side session lifetime policy (defence in depth, NOT server-enforced).
 *
 * - Absolute lifetime is anchored to the Auth server's `last_sign_in_at`,
 *   which a token refresh does not move, so a restored tab can never obtain a
 *   fresh lifetime.
 * - Idle time is measured from the last *genuine* user interaction stored in
 *   localStorage. Missing/invalid/future values fail closed, except within a
 *   short window right after a real login (first-login initialisation).
 */
export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const FRESH_LOGIN_MS = 5 * 60 * 1000;
export const CLOCK_SKEW_MS = 60 * 1000;
export const LAST_ACTIVITY_KEY = "rb.lastActivity";
export const SIGNOUT_BROADCAST_KEY = "rb.signoutAt";
/** Legacy key from the previous implementation; cleared on sign-out. */
export const LEGACY_SESSION_START_KEY = "rb.sessionStart";

export type SessionDecision =
  | { action: "ok" }
  | { action: "init" }
  | { action: "expire"; reason: "idle" | "absolute" | "missing" | "tampered" };

export function evaluateSession(input: {
  now: number;
  lastSignInAt: string | null | undefined;
  lastActivityRaw: string | null;
}): SessionDecision {
  const { now, lastSignInAt, lastActivityRaw } = input;
  const signIn = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  if (!Number.isFinite(signIn) || signIn > now + CLOCK_SKEW_MS) return { action: "expire", reason: "missing" };
  if (now - signIn > ABSOLUTE_MS) return { action: "expire", reason: "absolute" };

  const isFreshLogin = now - signIn <= FRESH_LOGIN_MS;
  const last = lastActivityRaw !== null && /^\d+$/.test(lastActivityRaw) ? Number(lastActivityRaw) : NaN;

  if (Number.isFinite(last) && last > now + CLOCK_SKEW_MS) return { action: "expire", reason: "tampered" };
  // Missing, invalid, or left over from an earlier login.
  if (!Number.isFinite(last) || last < signIn - CLOCK_SKEW_MS) {
    return isFreshLogin ? { action: "init" } : { action: "expire", reason: "missing" };
  }
  if (now - last > IDLE_MS) return { action: "expire", reason: "idle" };
  return { action: "ok" };
}
