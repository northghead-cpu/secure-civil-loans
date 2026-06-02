// Client-side auth throttling. Reduces casual brute-force / credential-stuffing
// from a single browser. Not a substitute for server-side rate limiting.
//
// Hardening notes:
// - Email changes can't bypass throttling: a global per-mode bucket counts every
//   failure regardless of email, and a distinct-email tracker escalates the
//   lockout once an attacker rotates through several addresses in the window.
// - Tab switching can't bypass throttling: state lives in `localStorage`, which
//   is shared across same-origin tabs. Reads happen at write time to minimise
//   lost increments under concurrent tab races, and `subscribeThrottle` lets
//   the UI react to lockouts triggered in another tab.

type Bucket = { count: number; firstAt: number; lockedUntil: number };
type DistinctBucket = { firstAt: number; emails: string[] };

const KEY_PREFIX = "auth_throttle:";
const DISTINCT_PREFIX = "auth_throttle_distinct:";
const WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window
const MAX_ATTEMPTS = 5;
// Progressive lockouts (ms) applied after MAX_ATTEMPTS, indexed by overflow count.
const LOCKOUT_STEPS = [30_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

// Escalation: once a single mode sees this many distinct emails fail within the
// window, treat it as credential stuffing and skip straight to a long lockout.
const DISTINCT_EMAIL_THRESHOLD = 3;
const DISTINCT_EMAIL_LOCKOUT_MS = LOCKOUT_STEPS[LOCKOUT_STEPS.length - 1];

const storageKey = (scope: string) => `${KEY_PREFIX}${scope}`;
const distinctKey = (mode: string) => `${DISTINCT_PREFIX}${mode}`;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const read = (scope: string): Bucket => {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return { count: 0, firstAt: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<Bucket>;
    return {
      count: Number(parsed.count) || 0,
      firstAt: Number(parsed.firstAt) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { count: 0, firstAt: 0, lockedUntil: 0 };
  }
};

const write = (scope: string, b: Bucket) => {
  try { localStorage.setItem(storageKey(scope), JSON.stringify(b)); } catch { /* noop */ }
};

const readDistinct = (mode: string): DistinctBucket => {
  try {
    const raw = localStorage.getItem(distinctKey(mode));
    if (!raw) return { firstAt: 0, emails: [] };
    const parsed = JSON.parse(raw) as Partial<DistinctBucket>;
    return {
      firstAt: Number(parsed.firstAt) || 0,
      emails: Array.isArray(parsed.emails) ? parsed.emails.map(String) : [],
    };
  } catch {
    return { firstAt: 0, emails: [] };
  }
};

const writeDistinct = (mode: string, d: DistinctBucket) => {
  try { localStorage.setItem(distinctKey(mode), JSON.stringify(d)); } catch { /* noop */ }
};

export const checkThrottle = (scope: string): { allowed: boolean; retryInMs: number } => {
  const now = Date.now();
  const b = read(scope);
  if (b.lockedUntil && now < b.lockedUntil) {
    return { allowed: false, retryInMs: b.lockedUntil - now };
  }
  return { allowed: true, retryInMs: 0 };
};

export interface RecordFailureOptions {
  /** Mode for distinct-email tracking (e.g. "login"). */
  mode?: string;
  /** Raw email the failure is tied to. Will be normalized. */
  email?: string;
}

export const recordFailure = (
  scope: string,
  opts: RecordFailureOptions = {},
): { lockedUntil: number; count: number } => {
  const now = Date.now();
  // Re-read at write time to limit lost increments when two tabs race.
  const b = read(scope);
  if (!b.firstAt || now - b.firstAt > WINDOW_MS) {
    b.count = 0;
    b.firstAt = now;
  }
  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    const overflow = Math.min(b.count - MAX_ATTEMPTS, LOCKOUT_STEPS.length - 1);
    b.lockedUntil = Math.max(b.lockedUntil, now + LOCKOUT_STEPS[Math.max(overflow, 0)]);
  }

  // Distinct-email escalation: trip the global bucket once an attacker rotates
  // through several addresses within the window.
  if (opts.mode && opts.email) {
    const normalized = normalizeEmail(opts.email);
    if (normalized) {
      const d = readDistinct(opts.mode);
      if (!d.firstAt || now - d.firstAt > WINDOW_MS) {
        d.firstAt = now;
        d.emails = [];
      }
      if (!d.emails.includes(normalized)) d.emails.push(normalized);
      writeDistinct(opts.mode, d);

      if (d.emails.length >= DISTINCT_EMAIL_THRESHOLD) {
        b.lockedUntil = Math.max(b.lockedUntil, now + DISTINCT_EMAIL_LOCKOUT_MS);
      }
    }
  }

  write(scope, b);
  return { lockedUntil: b.lockedUntil, count: b.count };
};

export const recordSuccess = (scope: string, opts: { mode?: string } = {}) => {
  try { localStorage.removeItem(storageKey(scope)); } catch { /* noop */ }
  if (opts.mode) {
    try { localStorage.removeItem(distinctKey(opts.mode)); } catch { /* noop */ }
  }
};

/**
 * Subscribe to cross-tab updates for a scope. Fires whenever another tab
 * mutates the same bucket so the UI can re-run `checkThrottle`.
 * Returns an unsubscribe function.
 */
export const subscribeThrottle = (scope: string, cb: () => void): (() => void) => {
  const key = storageKey(scope);
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === key) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
};

export const formatRetry = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
};
