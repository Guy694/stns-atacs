"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type DashboardScopeToggleProps = {
  hasOwnFacility: boolean;
  currentScope: "mine" | "all";
};

const STORAGE_KEY = "atacs:dashboard-scope";

export function DashboardScopeToggle({ hasOwnFacility, currentScope }: DashboardScopeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!hasOwnFacility) return;
    if (searchParams.has("scope")) {
      window.localStorage.setItem(STORAGE_KEY, currentScope);
      return;
    }

    const storedScope = window.localStorage.getItem(STORAGE_KEY);
    if (!storedScope || storedScope === currentScope) return;
    if (storedScope !== "mine" && storedScope !== "all") return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("scope", storedScope);
    router.replace(`${pathname}?${nextParams.toString()}`);
  }, [currentScope, hasOwnFacility, pathname, router, searchParams]);

  if (!hasOwnFacility) return null;

  function updateScope(scope: "mine" | "all") {
    window.localStorage.setItem(STORAGE_KEY, scope);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("scope", scope);
    router.replace(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="flex shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white/70 p-0.5 text-sm font-medium shadow-sm">
      <button
        type="button"
        onClick={() => updateScope("mine")}
        className={`rounded-lg px-4 py-1.5 transition ${currentScope === "mine" ? "bg-[var(--accent-strong)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
      >
        <span className="sm:hidden">ของฉัน</span>
        <span className="hidden sm:inline">หน่วยงานของฉัน</span>
      </button>
      <button
        type="button"
        onClick={() => updateScope("all")}
        className={`rounded-lg px-4 py-1.5 transition ${currentScope === "all" ? "bg-[var(--accent-strong)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
      >
        ทุกหน่วยงาน
      </button>
    </div>
  );
}
