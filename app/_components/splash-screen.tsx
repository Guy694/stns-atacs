"use client";

import Image from "next/image";
import { useLayoutEffect, useState } from "react";

import { ROUTE_LOADING_ID, SPLASH_SEEN_KEY } from "@/lib/splash";

const MIN_VISIBLE_MS = 1200;
const MAX_VISIBLE_MS = 8000;
const FADE_MS = 450;

/**
 * Splash screen shown once per browser session, over the first page after signing in, until that page's
 * data has arrived (at least MIN_VISIBLE_MS, at most MAX_VISIBLE_MS). It is part of the server HTML so it
 * appears on the very first paint; a small inline script in the layout hides it before paint when this
 * session has already seen it. Click, Enter/Space or Escape skips it. Without JavaScript it fades out by CSS.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  // Layout effect: decided before the browser paints, so a session that has seen it never flashes it.
  useLayoutEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
    } catch {
      // Storage blocked (private mode): show it, but never block the page.
    }
    if (seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("gone");
      return;
    }
    const started = performance.now();
    let done = false;
    let fadeTimer: number | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
      } catch {
        // ignore
      }
      setPhase("leaving");
      fadeTimer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    };
    const pageReady = () => !document.getElementById(ROUTE_LOADING_ID);
    const check = () => {
      if (done) return;
      const elapsed = performance.now() - started;
      if (elapsed >= MAX_VISIBLE_MS || (elapsed >= MIN_VISIBLE_MS && pageReady())) finish();
    };
    const poll = window.setInterval(check, 150);
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") finish();
    };
    window.addEventListener("keydown", skip);
    (window as unknown as { __atacsSkipSplash?: () => void }).__atacsSkipSplash = finish;
    return () => {
      window.clearInterval(poll);
      if (fadeTimer) window.clearTimeout(fadeTimer);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      id="atacs-splash"
      className={`atacs-splash${phase === "leaving" ? " atacs-splash--leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="กำลังเปิดระบบ ATACS Satun"
      onClick={() => (window as unknown as { __atacsSkipSplash?: () => void }).__atacsSkipSplash?.()}
      suppressHydrationWarning
    >
      <div className="atacs-splash__inner">
        <div className="atacs-splash__logo">
          <Image src="/logo.png" alt="" width={112} height={112} priority className="h-full w-full object-contain" />
        </div>
        <p className="atacs-splash__brand">ATACS Satun</p>
        <p className="atacs-splash__sub">Asset Tracking and Control System</p>
        <p className="atacs-splash__title">ระบบทะเบียนทรัพย์สินและครุภัณฑ์ จังหวัดสตูล</p>
        <div className="atacs-splash__bar" aria-hidden="true"><span /></div>
        <p className="atacs-splash__hint">กำลังเตรียมข้อมูล…</p>
      </div>
      <p className="atacs-splash__footer">กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล</p>
    </div>
  );
}

/** Called on logout so the next sign-in in this tab shows the splash again. */
export function resetSplash() {
  try {
    window.sessionStorage.removeItem(SPLASH_SEEN_KEY);
  } catch {
    // ignore
  }
}
