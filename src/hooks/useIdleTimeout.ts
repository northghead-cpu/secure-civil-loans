import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 4 auth hardening: enforce an idle-session timeout and an absolute
 * session lifetime, plus cross-tab sign-out via storage events.
 *
 * Additive to Supabase's own token refresh — we only sign the user out; we
 * never extend a session beyond these caps.
 */
const IDLE_MS = 30 * 60 * 1000;          // 30 minutes of inactivity
const ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12 hours absolute cap
const LAST_ACTIVITY_KEY = "rb.lastActivity";
const SESSION_START_KEY = "rb.sessionStart";
const SIGNOUT_BROADCAST_KEY = "rb.signoutAt";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "visibilitychange",
] as const;

export function useIdleTimeout(active: boolean) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    if (!localStorage.getItem(SESSION_START_KEY)) {
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }

    const forceSignOut = async (reason: "idle" | "absolute" | "remote") => {
      try {
        localStorage.setItem(SIGNOUT_BROADCAST_KEY, Date.now().toString());
        localStorage.removeItem(SESSION_START_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        await supabase.auth.signOut();
      } finally {
        if (reason !== "remote") window.location.assign("/auth");
      }
    };

    const check = () => {
      const now = Date.now();
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || now);
      const started = Number(localStorage.getItem(SESSION_START_KEY) || now);
      if (now - last > IDLE_MS) return forceSignOut("idle");
      if (now - started > ABSOLUTE_MS) return forceSignOut("absolute");
    };

    const bump = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    };
    bump();

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    timerRef.current = window.setInterval(check, 60 * 1000);

    const onStorage = (e: StorageEvent) => {
      if (e.key === SIGNOUT_BROADCAST_KEY && e.newValue) {
        forceSignOut("remote");
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump));
      window.removeEventListener("storage", onStorage);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [active]);
}
