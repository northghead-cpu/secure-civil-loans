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
});
