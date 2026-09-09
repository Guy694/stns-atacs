"use client";

import { useEffect, useRef } from "react";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_NOTICE = "ไม่มีการใช้งานเกิน 15 นาที ระบบออกจากระบบอัตโนมัติ";

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

      isLoggingOutRef.current = true;
      clearExistingTimer();

      try {
        await fetch("/logout", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        // Ignore network errors and still redirect to login.
      }

      const loginUrl = `/login?notice=${encodeURIComponent(IDLE_NOTICE)}`;
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
      resetIdleTimer();
    };

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
