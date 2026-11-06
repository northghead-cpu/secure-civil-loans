import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: (...a: unknown[]) => signOut(...a) } } }));

import { beginSessionMetadata, clearSessionMetadata, useIdleTimeout } from "@/hooks/useIdleTimeout";
import { LAST_ACTIVITY_KEY, SESSION_START_KEY, SIGNOUT_BROADCAST_KEY } from "@/lib/sessionPolicy";

const MIN = 60_000;
const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const assign = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  signOut.mockClear();
  assign.mockClear();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, pathname: "/profile", assign } });
});
afterEach(() => vi.useRealTimers());

const user = (signedInAgoMs: number) => ({ last_sign_in_at: new Date(NOW - signedInAgoMs).toISOString() });
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("useIdleTimeout", () => {
  it("clears stale activity and sign-out markers before a fresh login", () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW + 10 * MIN));
    localStorage.setItem(SIGNOUT_BROADCAST_KEY, String(NOW - MIN));
    clearSessionMetadata();
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_START_KEY)).toBeNull();
    expect(localStorage.getItem(SIGNOUT_BROADCAST_KEY)).toBeNull();
  });

  it("seeds a fresh explicit login before auth state listeners run", async () => {
    beginSessionMetadata();
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(String(NOW));
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(String(NOW));

    renderHook(() => useIdleTimeout(user(60 * MIN)));
    await flush();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps a fresh login alive when last_sign_in_at is absent", async () => {
    beginSessionMetadata();
    renderHook(() => useIdleTimeout({}));
    await flush();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("expires an explicit session after the absolute lifetime", async () => {
    localStorage.setItem(SESSION_START_KEY, String(NOW - 13 * 60 * MIN));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW));
    renderHook(() => useIdleTimeout(user(MIN)));
    await flush();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("does not reset last activity on mount and signs out a stale restored tab immediately", async () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW - 8 * 60 * MIN));
    renderHook(() => useIdleTimeout(user(9 * 60 * MIN)));
    await flush();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("keeps the session alive with genuine activity", async () => {
    renderHook(() => useIdleTimeout(user(MIN)));
    await flush();
    expect(signOut).not.toHaveBeenCalled();
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(20 * MIN);
      window.dispatchEvent(new Event("keydown"));
    }
    expect(signOut).not.toHaveBeenCalled();
  });

  it("re-checks on visibility return after sleep (no timer needed)", async () => {
    renderHook(() => useIdleTimeout(user(MIN)));
    await flush();
    vi.setSystemTime(NOW + 45 * MIN); // laptop slept; intervals did not fire
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
  });

  it("signs out on cross-tab broadcast without re-broadcasting", async () => {
    renderHook(() => useIdleTimeout(user(MIN)));
    await flush();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    window.dispatchEvent(new StorageEvent("storage", { key: SIGNOUT_BROADCAST_KEY, newValue: String(NOW) }));
    await flush();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls.some(([k]) => k === SIGNOUT_BROADCAST_KEY)).toBe(false);
    setItem.mockRestore();
  });

  it("fails closed on tampered activity value", async () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW + 10 * 60 * MIN));
    renderHook(() => useIdleTimeout(user(60 * MIN)));
    await flush();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a future session-start marker", async () => {
    localStorage.setItem(SESSION_START_KEY, String(NOW + 10 * MIN));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW));
    renderHook(() => useIdleTimeout(user(MIN)));
    await flush();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when already on /login", async () => {
    (window.location as { pathname: string }).pathname = "/login";
    renderHook(() => useIdleTimeout(user(13 * 60 * MIN)));
    await flush();
    expect(signOut).toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
