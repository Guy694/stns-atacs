"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { withBasePath } from "@/lib/base-path";

/** Reports one page view per route change (including client-side navigation) to /api/visit/. */
export function VisitBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    const referrer = last.current === null ? document.referrer : "";
    last.current = pathname;
    const body = JSON.stringify({ path: pathname, referrer });
    const url = withBasePath("/api/visit/");
    try {
      if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
    } catch {
      // fall through to fetch
    }
    void fetch(url, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => {});
  }, [pathname]);

  return null;
}
