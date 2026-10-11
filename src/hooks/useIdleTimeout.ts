import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateSession,
  LAST_ACTIVITY_KEY,
  LEGACY_SESSION_START_KEY,
  SIGNOUT_BROADCAST_KEY,
} from "@/lib/sessionPolicy";

/**
 * Client-side idle (30m) and absolute (12h) session caps plus cross-tab
 * sign-out. Defence in depth only: real enforcement is the Auth server's
 * session/refresh-token policy and RLS on every table.
 */
const INTERACTION_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;
const CHECK_INTERVAL_MS = 30 * 1000;

export function clearSessionMetadata() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(LEGACY_SESSION_START_KEY);
}

export function useIdleTimeout(user: { last_sign_in_at?: string | null } | null) {
  const active = !!user;
  const lastSignInAt = user?.last_sign_in_at ?? null;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let signingOut = false;

    const forceSignOut = async (broadcast: boolean) => {
      if (signingOut) return;
      signingOut = true;
      clearSessionMetadata();
      if (broadcast) localStorage.setItem(SIGNOUT_BROADCAST_KEY, Date.now().toString());
      try {
        await supabase.auth.signOut({ scope: "local" });
      } finally {
        if (window.location.pathname !== "/login") window.location.assign("/login");
      }
    };

    const check = () => {
      if (signingOut) return;
      const d = evaluateSession({ now: Date.now(), lastSignInAt, lastActivityRaw: localStorage.getItem(LAST_ACTIVITY_KEY) });
      if (d.action === "init") localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      else if (d.action === "expire") void forceSignOut(true);
    };

    // Genuine interaction only: check first so a woken tab can't refresh itself.
    const onInteraction = () => {
      check();
      if (!signingOut) localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    };
    const onResume = () => {
      if (document.visibilityState !== "hidden") check();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIGNOUT_BROADCAST_KEY && e.newValue) void forceSignOut(false);
    };

    check();
    INTERACTION_EVENTS.forEach((e) => window.addEventListener(e, onInteraction, { passive: true }));
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("online", onResume);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      INTERACTION_EVENTS.forEach((e) => window.removeEventListener(e, onInteraction));
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("online", onResume);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [active, lastSignInAt]);
}
