import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkThrottle,
  recordFailure,
  recordSuccess,
  formatRetry,
  normalizeEmail,
  subscribeThrottle,
} from "../authThrottle";

const SCOPE = "login:user@example.com";
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_STEPS = [30_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

describe("authThrottle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe("checkThrottle", () => {
    it("allows by default when no record exists", () => {
      const res = checkThrottle(SCOPE);
      expect(res).toEqual({ allowed: true, retryInMs: 0 });
    });

    it("allows when bucket has failures but is not locked", () => {
      recordFailure(SCOPE);
      recordFailure(SCOPE);
      expect(checkThrottle(SCOPE).allowed).toBe(true);
    });

    it("blocks while lockout is active and reports remaining time", () => {
      for (let i = 0; i < 5; i++) recordFailure(SCOPE);
      const res = checkThrottle(SCOPE);
      expect(res.allowed).toBe(false);
      expect(res.retryInMs).toBeGreaterThan(0);
      expect(res.retryInMs).toBeLessThanOrEqual(LOCKOUT_STEPS[0]);
    });

    it("allows again once the lockout has elapsed", () => {
      for (let i = 0; i < 5; i++) recordFailure(SCOPE);
      vi.advanceTimersByTime(LOCKOUT_STEPS[0] + 1);
      expect(checkThrottle(SCOPE).allowed).toBe(true);
    });

    it("tolerates corrupt storage payloads", () => {
      localStorage.setItem(`auth_throttle:${SCOPE}`, "{not json");
      expect(checkThrottle(SCOPE)).toEqual({ allowed: true, retryInMs: 0 });
    });
  });

  describe("recordFailure counter", () => {
    it("increments the counter on each call", () => {
      expect(recordFailure(SCOPE).count).toBe(1);
      expect(recordFailure(SCOPE).count).toBe(2);
      expect(recordFailure(SCOPE).count).toBe(3);
    });

    it("does not lock before MAX_ATTEMPTS", () => {
      for (let i = 0; i < 4; i++) {
        const r = recordFailure(SCOPE);
        expect(r.lockedUntil).toBe(0);
      }
    });

    it("locks on the 5th attempt with the first step (30s)", () => {
      let last = { lockedUntil: 0, count: 0 };
      for (let i = 0; i < 5; i++) last = recordFailure(SCOPE);
      expect(last.count).toBe(5);
      expect(last.lockedUntil - Date.now()).toBe(LOCKOUT_STEPS[0]);
    });

    it("applies progressive lockouts on subsequent overflow attempts", () => {
      for (let i = 0; i < 5; i++) recordFailure(SCOPE);
      const expected = [
        LOCKOUT_STEPS[1],
        LOCKOUT_STEPS[2],
        LOCKOUT_STEPS[3],
        LOCKOUT_STEPS[4],
      ];
      for (const step of expected) {
        const r = recordFailure(SCOPE);
        expect(r.lockedUntil - Date.now()).toBe(step);
      }
    });

    it("clamps the lockout at the final step for further attempts", () => {
      for (let i = 0; i < 5 + 4; i++) recordFailure(SCOPE);
      const r = recordFailure(SCOPE);
      expect(r.lockedUntil - Date.now()).toBe(LOCKOUT_STEPS[LOCKOUT_STEPS.length - 1]);
    });
  });

  describe("sliding window reset", () => {
    it("resets the counter after the window expires", () => {
      recordFailure(SCOPE);
      recordFailure(SCOPE);
      vi.advanceTimersByTime(WINDOW_MS + 1);
      expect(recordFailure(SCOPE).count).toBe(1);
    });

    it("keeps the counter when failures fall inside the window", () => {
      recordFailure(SCOPE);
      vi.advanceTimersByTime(WINDOW_MS - 1000);
      expect(recordFailure(SCOPE).count).toBe(2);
    });
  });

  describe("recordSuccess", () => {
    it("clears the bucket and removes the lockout", () => {
      for (let i = 0; i < 5; i++) recordFailure(SCOPE);
      expect(checkThrottle(SCOPE).allowed).toBe(false);
      recordSuccess(SCOPE);
      expect(checkThrottle(SCOPE).allowed).toBe(true);
      expect(localStorage.getItem(`auth_throttle:${SCOPE}`)).toBeNull();
    });

    it("is a no-op when no bucket exists", () => {
      expect(() => recordSuccess(SCOPE)).not.toThrow();
    });
  });

  describe("scope isolation", () => {
    it("keeps per-email and global buckets independent", () => {
      const emailScope = "login:a@b.com";
      const globalScope = "login:_global";
      for (let i = 0; i < 5; i++) recordFailure(emailScope);
      expect(checkThrottle(emailScope).allowed).toBe(false);
      expect(checkThrottle(globalScope).allowed).toBe(true);
    });
  });

  describe("formatRetry", () => {
    it("formats sub-minute durations in seconds", () => {
      expect(formatRetry(5_000)).toBe("5s");
      expect(formatRetry(59_000)).toBe("59s");
    });

    it("formats minute-scale durations with pluralization", () => {
      expect(formatRetry(60_000)).toBe("1 minute");
      expect(formatRetry(120_000)).toBe("2 minutes");
      expect(formatRetry(15 * 60_000)).toBe("15 minutes");
    });

    it("rounds partial seconds up", () => {
      expect(formatRetry(1_200)).toBe("2s");
    });
  });

  describe("integration: full lockout lifecycle", () => {
    it("walks through fail → lock → wait → retry → success → reset", () => {
      for (let i = 0; i < 5; i++) recordFailure(SCOPE);
      expect(checkThrottle(SCOPE).allowed).toBe(false);

      vi.advanceTimersByTime(LOCKOUT_STEPS[0] / 2);
      expect(checkThrottle(SCOPE).allowed).toBe(false);

      vi.advanceTimersByTime(LOCKOUT_STEPS[0] / 2 + 1);
      expect(checkThrottle(SCOPE).allowed).toBe(true);

      recordSuccess(SCOPE);
      expect(checkThrottle(SCOPE)).toEqual({ allowed: true, retryInMs: 0 });
      expect(recordFailure(SCOPE).count).toBe(1);
    });
  });

  describe("bypass hardening — email rotation", () => {
    const GLOBAL = "login:_global";

    it("normalizeEmail trims and lowercases", () => {
      expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
      expect(normalizeEmail("")).toBe("");
    });

    it("treats per-email buckets independently (motivates the global bucket)", () => {
      for (let i = 0; i < 5; i++) recordFailure("login:a@x.com");
      expect(checkThrottle("login:a@x.com").allowed).toBe(false);
      // A fresh email starts clean — this is exactly why callers must also
      // record against the global bucket.
      expect(checkThrottle("login:b@x.com").allowed).toBe(true);
    });

    it("global bucket counts every failure regardless of which email was used", () => {
      // 5 different emails, each failing once — the global bucket should lock.
      for (let i = 0; i < 5; i++) {
        recordFailure(`login:user${i}@x.com`);
        recordFailure(GLOBAL, { mode: "login", email: `user${i}@x.com` });
      }
      expect(checkThrottle(GLOBAL).allowed).toBe(false);
    });

    it("escalates to the maximum lockout when 3+ distinct emails fail in the window", () => {
      const first = recordFailure(GLOBAL, { mode: "login", email: "one@x.com" });
      expect(first.lockedUntil).toBe(0);
      recordFailure(GLOBAL, { mode: "login", email: "two@x.com" });
      const third = recordFailure(GLOBAL, { mode: "login", email: "three@x.com" });
      // Distinct-email tripwire applies the longest lockout step (1h) even
      // though the regular counter is only at 3.
      expect(third.lockedUntil - Date.now()).toBe(LOCKOUT_STEPS[LOCKOUT_STEPS.length - 1]);
      expect(checkThrottle(GLOBAL).allowed).toBe(false);
    });

    it("ignores repeats of the same email when counting distinct addresses", () => {
      for (let i = 0; i < 4; i++) {
        recordFailure(GLOBAL, { mode: "login", email: "same@x.com" });
      }
      // Only 1 distinct email → no escalation yet (count is below MAX_ATTEMPTS).
      expect(checkThrottle(GLOBAL).allowed).toBe(true);
    });

    it("normalizes emails before counting distinct (case/whitespace can't inflate or bypass)", () => {
      recordFailure(GLOBAL, { mode: "login", email: "Foo@x.com" });
      recordFailure(GLOBAL, { mode: "login", email: " foo@x.com " });
      const r = recordFailure(GLOBAL, { mode: "login", email: "FOO@X.COM" });
      // All three normalize to the same address → still 1 distinct → no escalation.
      expect(r.lockedUntil).toBe(0);
    });

    it("resets the distinct-email tracker after the window expires", () => {
      recordFailure(GLOBAL, { mode: "login", email: "a@x.com" });
      recordFailure(GLOBAL, { mode: "login", email: "b@x.com" });
      vi.advanceTimersByTime(WINDOW_MS + 1);
      const r = recordFailure(GLOBAL, { mode: "login", email: "c@x.com" });
      // Tracker rolled over → only 1 distinct in the new window → no escalation.
      expect(r.lockedUntil).toBe(0);
    });

    it("recordSuccess with mode clears the distinct-email tracker", () => {
      recordFailure(GLOBAL, { mode: "login", email: "a@x.com" });
      recordFailure(GLOBAL, { mode: "login", email: "b@x.com" });
      recordSuccess(GLOBAL, { mode: "login" });
      const r = recordFailure(GLOBAL, { mode: "login", email: "c@x.com" });
      // Tracker cleared → only 1 distinct → no escalation, count back to 1.
      expect(r.count).toBe(1);
      expect(r.lockedUntil).toBe(0);
    });
  });

  describe("bypass hardening — tab switching", () => {
    it("state persists in localStorage so a 'new tab' sees the same lockout", () => {
      // Simulate tab A locking the bucket.
      for (let i = 0; i < 5; i++) recordFailure(SCOPE);
      const snapshot = localStorage.getItem(`auth_throttle:${SCOPE}`);
      expect(snapshot).not.toBeNull();

      // Simulate tab B starting fresh: it reads the same localStorage and is
      // still locked. (No reset, no in-memory bypass.)
      expect(checkThrottle(SCOPE).allowed).toBe(false);
    });

    it("merges concurrent failures from two tabs without losing the lockout", () => {
      // Both tabs read at count=4 and each try to record one more failure.
      // Because recordFailure re-reads at write time, the second write picks
      // up the first one and still trips the lockout.
      for (let i = 0; i < 4; i++) recordFailure(SCOPE);
      const tabA = recordFailure(SCOPE);
      const tabB = recordFailure(SCOPE);
      expect(tabA.count).toBe(5);
      expect(tabB.count).toBe(6);
      expect(checkThrottle(SCOPE).allowed).toBe(false);
    });

    it("never shortens an existing lockout if another tab writes a smaller one", () => {
      // Force a long lockout (escalated via distinct emails).
      const GLOBAL = "login:_global";
      recordFailure(GLOBAL, { mode: "login", email: "a@x.com" });
      recordFailure(GLOBAL, { mode: "login", email: "b@x.com" });
      recordFailure(GLOBAL, { mode: "login", email: "c@x.com" });
      const longLock = checkThrottle(GLOBAL).retryInMs;
      expect(longLock).toBeGreaterThan(LOCKOUT_STEPS[0]);

      // A concurrent plain failure must not shrink the lockout window.
      recordFailure(GLOBAL);
      expect(checkThrottle(GLOBAL).retryInMs).toBeGreaterThanOrEqual(longLock - 10);
    });

    it("subscribeThrottle fires when another tab mutates the same key", () => {
      const cb = vi.fn();
      const unsubscribe = subscribeThrottle(SCOPE, cb);

      // Simulate another tab writing to the same key by dispatching a
      // StorageEvent (jsdom does not auto-fire these for same-window writes).
      window.dispatchEvent(
        new StorageEvent("storage", { key: `auth_throttle:${SCOPE}` }),
      );
      expect(cb).toHaveBeenCalledTimes(1);

      // Unrelated keys are ignored.
      window.dispatchEvent(
        new StorageEvent("storage", { key: "unrelated" }),
      );
      expect(cb).toHaveBeenCalledTimes(1);

      // localStorage.clear() fires with key=null — should also notify.
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
      expect(cb).toHaveBeenCalledTimes(2);

      unsubscribe();
      window.dispatchEvent(
        new StorageEvent("storage", { key: `auth_throttle:${SCOPE}` }),
      );
      expect(cb).toHaveBeenCalledTimes(2);
    });
  });
});
