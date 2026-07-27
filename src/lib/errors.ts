/**
 * Central error sanitization for user-facing surfaces (toasts, inline
 * form errors, redirect messages).
 *
 * Rationale: raw error strings from Supabase, PostgREST, edge functions
 * and third-party SDKs can leak internal identifiers, table names, RLS
 * policy names, JWT hints, and stack fragments. This module maps them
 * onto a small set of neutral, non-enumerating messages.
 *
 * NEVER return `err.message` directly to the UI. Route it through
 * `sanitizeError` (or use `GENERIC_ERROR`) instead.
 */

export const GENERIC_ERROR = "Something went wrong. Please try again.";

const AUTH_HINTS = [
  "invalid",
  "password",
  "credentials",
  "user not found",
  "email not confirmed",
  "signup",
  "not authorized",
];

const NETWORK_HINTS = ["fetch", "network", "timeout", "failed to load"];

const RATE_HINTS = ["rate", "too many", "throttle"];

const PERMISSION_HINTS = [
  "permission",
  "rls",
  "row-level",
  "not allowed",
  "forbidden",
  "42501",
];

/**
 * Sanitize any thrown value into a short, non-revealing message safe to
 * display to end users. The original error should still be captured via
 * `logger.error` for forensic use, but never rendered.
 */
export function sanitizeError(err: unknown, fallback: string = GENERIC_ERROR): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = raw.toLowerCase();

  if (!raw) return fallback;
  if (AUTH_HINTS.some((h) => lower.includes(h))) {
    return "Invalid email or password combination.";
  }
  if (RATE_HINTS.some((h) => lower.includes(h))) {
    return "Too many attempts. Please try again later.";
  }
  if (PERMISSION_HINTS.some((h) => lower.includes(h))) {
    return "You don't have permission to perform this action.";
  }
  if (NETWORK_HINTS.some((h) => lower.includes(h))) {
    return "Network error. Please check your connection and try again.";
  }
  return fallback;
}
