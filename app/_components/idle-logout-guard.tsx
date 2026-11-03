"use client";

import { useEffect, useRef } from "react";
import { withBasePath } from "@/lib/base-path";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_NOTICE = "ไม่มีการใช้งานเกิน 15 นาที ระบบออกจากระบบอัตโนมัติ";
// Shared by all tabs (the session cookie is shared): activity in any tab keeps every tab signed in.
const ACTIVITY_KEY = "atacs:last-activity";

function readSharedActivity() {
  try {
    return Number(window.localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0; // storage blocked (private mode): fall back to this tab only
  }
}

function writeSharedActivity(at: number) {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // ignore
  }
}

export function IdleLogoutGuard() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggingOutRef = useRef(false);
  const lastResetRef = useRef(0);

  useEffect(() => {
    const clearExistingTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const logoutForIdle = async () => {
      if (isLoggingOutRef.current) {
        return;
      }

      // Another tab may have been used since this timer started.
      const idleFor = Date.now() - Math.max(readSharedActivity(), lastResetRef.current);
      if (idleFor < IDLE_TIMEOUT_MS) {
        clearExistingTimer();
        timeoutRef.current = setTimeout(logoutForIdle, IDLE_TIMEOUT_MS - idleFor);
        return;
      }

      isLoggingOutRef.current = true;
      clearExistingTimer();

      try {
        await fetch(withBasePath("/logout/"), {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        // Ignore network errors and still redirect to login.
      }

      const loginUrl = withBasePath(`/login?notice=${encodeURIComponent(IDLE_NOTICE)}`);
      window.location.replace(loginUrl);
    };

    const resetIdleTimer = () => {
      if (isLoggingOutRef.current) {
        return;
      }

      clearExistingTimer();
      timeoutRef.current = setTimeout(logoutForIdle, IDLE_TIMEOUT_MS);
    };

    const onActivity = (event: Event) => {
      if (event.type === "visibilitychange" && document.visibilityState !== "visible") {
        return;
      }

      // Throttle high-frequency events so we do not reset timers excessively.
      const now = Date.now();
      if ((event.type === "pointermove" || event.type === "scroll") && now - lastResetRef.current < 1000) {
        return;
      }

      lastResetRef.current = now;
      writeSharedActivity(now);
      resetIdleTimer();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVITY_KEY) resetIdleTimer();
    };
    window.addEventListener("storage", onStorage);

    const passiveOptions: AddEventListenerOptions = { passive: true };
    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
      "visibilitychange",
    ] as const;

    activityEvents.forEach((eventName) => {
      if (eventName === "visibilitychange") {
        document.addEventListener(eventName, onActivity);
        return;
      }

      window.addEventListener(eventName, onActivity, passiveOptions);
    });

    resetIdleTimer();

    return () => {
      clearExistingTimer();
      window.removeEventListener("storage", onStorage);
      activityEvents.forEach((eventName) => {
        if (eventName === "visibilitychange") {
          document.removeEventListener(eventName, onActivity);
          return;
        }

        window.removeEventListener(eventName, onActivity);
      });
    };
  }, []);

  return null;
}
