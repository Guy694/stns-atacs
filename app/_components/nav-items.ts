import type { IconName } from "@/app/_components/ui/icon";
import { APP_MENU_ITEMS, type AppMenuGroupKey } from "@/lib/menu";

/**
 * Menu rules shared by the sidebar (desktop + mobile drawer) and the mobile bottom bar,
 * so both always show the same set of destinations for a user.
 */
export type NavUser = {
  fullName: string;
  role: "admin" | "officer" | "viewer";
  facilityId?: number | null;
  managedAssetFacilityIds?: number[];
};

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  group: AppMenuGroupKey;
  adminOnly?: boolean;
  officerOnly?: boolean;
  hideForViewer?: boolean;
  permissionKey?: string;
  exact?: boolean;
};

export type NavContext = {
  user: NavUser;
  grantedPermissions: string[];
  menuVisibility: Record<string, boolean>;
};

function officerAssetsItem(user: NavUser): NavItem {
  const managed = user.managedAssetFacilityIds ?? [];
  const managesMany = managed.length > 1;
  // Officers with exactly one managed facility but no home facility still land on that facility.
  const singleFacilityId = user.facilityId ?? (managed.length === 1 ? managed[0] : null);
  return {
    key: "officer-assets",
    href: managesMany ? "/facilities" : singleFacilityId ? `/facilities/${singleFacilityId}` : "/profile",
    label: managesMany ? "หน่วยงานในความดูแล" : "รายการทรัพย์สิน",
    icon: "package",
    group: "overview",
  };
}

export function buildNavItems({ user, grantedPermissions, menuVisibility }: NavContext): NavItem[] {
  return APP_MENU_ITEMS.flatMap((item): NavItem[] => {
    if (!menuVisibility[item.key]) return [];
    // Officers see their facility register in place of the province-wide list; it follows the same "assets" toggle.
    if (user.role === "officer" && item.key === "assets") return [officerAssetsItem(user)];
    if (item.adminOnly && user.role !== "admin") return [];
    if (item.officerOnly && user.role !== "officer") return [];
    if (item.hideForViewer && user.role === "viewer") return [];
    if (item.permissionKey && !grantedPermissions.includes(item.permissionKey)) return [];
    return [item];
  });
}

function trimTrailingSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

/** True when `pathname` is `base` or below it, ignoring trailing slashes (next.config uses trailingSlash: true). */
export function pathMatches(pathname: string, base: string, exact = false) {
  const current = trimTrailingSlash(pathname);
  const target = trimTrailingSlash(base);
  if (current === target) return true;
  if (exact) return false;
  return current.startsWith(target === "/" ? "/" : `${target}/`);
}

function matchesPath(item: NavItem, pathname: string) {
  return pathMatches(pathname, item.href, item.exact);
}

/** Only the most specific matching item is active (/admin/settings/work-groups must not also light up /admin/settings). */
export function activeHrefFor(items: NavItem[], pathname: string) {
  return items.filter((item) => matchesPath(item, pathname)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
