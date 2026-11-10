import { describe, it, expect } from "vitest";
import { evaluateSession, IDLE_MS, ABSOLUTE_MS, FRESH_LOGIN_MS } from "@/lib/sessionPolicy";

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;

describe("evaluateSession", () => {
  it("keeps a session active with recent genuine activity", () => {
    expect(evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 60 * MIN), lastActivityRaw: String(NOW - 5 * MIN) }).action).toBe("ok");
  });

  it("expires after 30 minutes of inactivity", () => {
    expect(IDLE_MS).toBe(30 * MIN);
    const r = evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 60 * MIN), lastActivityRaw: String(NOW - 31 * MIN) });
    expect(r).toEqual({ action: "expire", reason: "idle" });
  });

  it("does not expire at exactly 29 minutes idle", () => {
    expect(evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 60 * MIN), lastActivityRaw: String(NOW - 29 * MIN) }).action).toBe("ok");
  });

  it("enforces the 12-hour absolute cap even with fresh activity", () => {
    expect(ABSOLUTE_MS).toBe(12 * 60 * MIN);
    const r = evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 12 * 60 * MIN - MIN), lastActivityRaw: String(NOW - MIN) });
    expect(r).toEqual({ action: "expire", reason: "absolute" });
  });

  it("expires an overnight-restored tab (sleep for 8 hours)", () => {
    const r = evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 9 * 60 * MIN), lastActivityRaw: String(NOW - 8 * 60 * MIN) });
    expect(r).toEqual({ action: "expire", reason: "idle" });
  });

  it("fails closed when activity metadata is missing on a restored (non-fresh) session", () => {
    const r = evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 3 * 60 * MIN), lastActivityRaw: null });
    expect(r).toEqual({ action: "expire", reason: "missing" });
  });

  it("initialises activity for a genuinely fresh login", () => {
    const r = evaluateSession({ now: NOW, lastSignInAt: iso(NOW - MIN), lastActivityRaw: null });
    expect(r.action).toBe("init");
    expect(FRESH_LOGIN_MS).toBeLessThanOrEqual(5 * MIN);
  });

  it("fails closed on non-numeric (tampered) activity values", () => {
    expect(evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 3 * 60 * MIN), lastActivityRaw: "abc" })).toEqual({ action: "expire", reason: "missing" });
  });

  it("fails closed on future-dated (tampered) activity values", () => {
    expect(evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 60 * MIN), lastActivityRaw: String(NOW + 60 * MIN) })).toEqual({ action: "expire", reason: "tampered" });
  });

  it("ignores activity left over from a previous login", () => {
    const r = evaluateSession({ now: NOW, lastSignInAt: iso(NOW - 2 * 60 * MIN), lastActivityRaw: String(NOW - 3 * 60 * MIN) });
    expect(r).toEqual({ action: "expire", reason: "missing" });
  });

  it("fails closed when the login timestamp is missing or invalid", () => {
    expect(evaluateSession({ now: NOW, lastSignInAt: undefined, lastActivityRaw: String(NOW) })).toEqual({ action: "expire", reason: "missing" });
    expect(evaluateSession({ now: NOW, lastSignInAt: "garbage", lastActivityRaw: String(NOW) })).toEqual({ action: "expire", reason: "missing" });
  });
});
