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

export function buildNavItems({ user, grantedPermissions, menuVisibility }: NavContext): NavItem[] {
  const baseItems = APP_MENU_ITEMS.filter((item) => {
    if (!menuVisibility[item.key]) return false;
    if (user.role === "officer" && item.key === "assets") return false;
    if (item.adminOnly && user.role !== "admin") return false;
    if (item.officerOnly && user.role !== "officer") return false;
    if (item.hideForViewer && user.role === "viewer") return false;
    if (item.permissionKey && !grantedPermissions.includes(item.permissionKey)) return false;
    return true;
  });
  if (user.role !== "officer") return baseItems;

  const managesMany = (user.managedAssetFacilityIds?.length ?? 0) > 1;
  return baseItems.flatMap((item) => {
    if (item.key !== "dashboard") return [item];
    return [
      item,
      {
        key: "officer-assets",
        href: managesMany ? "/facilities" : user.facilityId ? `/facilities/${user.facilityId}` : "/profile",
        label: managesMany ? "หน่วยงานในความดูแล" : "รายการทรัพย์สิน",
        icon: "package",
        group: "overview",
      },
    ];
  });
}

function matchesPath(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href.endsWith("/") ? item.href : `${item.href}/`);
}

/** Only the most specific matching item is active (/admin/settings/work-groups must not also light up /admin/settings). */
export function activeHrefFor(items: NavItem[], pathname: string) {
  return items.filter((item) => matchesPath(item, pathname)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
