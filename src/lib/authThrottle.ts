// Client-side auth throttling. Reduces casual brute-force / credential-stuffing
// from a single browser. Not a substitute for server-side rate limiting.

type Bucket = { count: number; firstAt: number; lockedUntil: number };

const KEY_PREFIX = "auth_throttle:";
const WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window
const MAX_ATTEMPTS = 5;
// Progressive lockouts (ms) applied after MAX_ATTEMPTS, indexed by overflow count.
const LOCKOUT_STEPS = [30_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

const storageKey = (scope: string) => `${KEY_PREFIX}${scope}`;

const read = (scope: string): Bucket => {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return { count: 0, firstAt: 0, lockedUntil: 0 };
    return JSON.parse(raw) as Bucket;
  } catch {
    return { count: 0, firstAt: 0, lockedUntil: 0 };
  }
};

const write = (scope: string, b: Bucket) => {
  try { localStorage.setItem(storageKey(scope), JSON.stringify(b)); } catch { /* noop */ }
};

export const checkThrottle = (scope: string): { allowed: boolean; retryInMs: number } => {
  const now = Date.now();
  const b = read(scope);
  if (b.lockedUntil && now < b.lockedUntil) {
    return { allowed: false, retryInMs: b.lockedUntil - now };
  }
  return { allowed: true, retryInMs: 0 };
};

export const recordFailure = (scope: string): { lockedUntil: number; count: number } => {
  const now = Date.now();
  const b = read(scope);
  // Reset window if expired
  if (!b.firstAt || now - b.firstAt > WINDOW_MS) {
    b.count = 0;
    b.firstAt = now;
  }
  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    const overflow = Math.min(b.count - MAX_ATTEMPTS, LOCKOUT_STEPS.length - 1);
    b.lockedUntil = now + LOCKOUT_STEPS[Math.max(overflow, 0)];
  }
  write(scope, b);
  return { lockedUntil: b.lockedUntil, count: b.count };
};

export const recordSuccess = (scope: string) => {
  try { localStorage.removeItem(storageKey(scope)); } catch { /* noop */ }
};

export const formatRetry = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
};
