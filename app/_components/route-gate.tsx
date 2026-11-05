"use client";

import { usePathname } from "next/navigation";

import { pathMatches } from "@/app/_components/nav-items";

/**
 * Renders its (server-rendered) children only on the given routes.
 * Each entry matches the exact path and everything below it, e.g. "/admin/settings" matches "/admin/settings/menus".
 */
export function RouteGate({ paths, children }: { paths: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const visible = paths.some((path) => pathMatches(pathname, path));
  return visible ? <>{children}</> : null;
}
