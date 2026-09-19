"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { APP_MENU_GROUPS, APP_MENU_ITEMS, type AppMenuGroupKey } from "@/lib/menu";

type NavUser = {
  fullName: string;
  role: "admin" | "officer" | "viewer";
  facilityId?: number | null;
  managedAssetFacilityIds?: number[];
};

type SidebarProps = {
  user: NavUser;
  grantedPermissions: string[];
  pendingRegistrationCount: number;
  menuVisibility: Record<string, boolean>;
};

type NavItem = {
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

function NavLink({
  item,
  pathname,
  pendingRegistrationCount,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  pendingRegistrationCount: number;
  onClick?: () => void;
}) {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const badgeCount = item.href === "/admin/users" ? pendingRegistrationCount : 0;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-white/20 text-white shadow-sm ring-1 ring-white/25"
          : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      <AppIcon name={item.icon} className="w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badgeCount > 0 && (
        <span className="min-w-5 rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-amber-950">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ user, grantedPermissions, pendingRegistrationCount, menuVisibility }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const baseItems = APP_MENU_ITEMS.filter((item) => {
    if (!menuVisibility[item.key]) return false;
    if (user.role === "officer" && item.key === "assets") return false;
    if (item.adminOnly && user.role !== "admin") return false;
    if (item.officerOnly && user.role !== "officer") return false;
    if (item.hideForViewer && user.role === "viewer") return false;
    if (item.permissionKey && !grantedPermissions.includes(item.permissionKey)) return false;
    return true;
  });
  const items: NavItem[] =
    user.role === "officer"
      ? baseItems.flatMap((item) => {
          if (item.key !== "dashboard") return [item];
          return [
            item,
            {
              key: "officer-assets",
              href: (user.managedAssetFacilityIds?.length ?? 0) > 1
                ? "/facilities"
                : user.facilityId
                  ? `/facilities/${user.facilityId}`
                  : "/profile",
              label: (user.managedAssetFacilityIds?.length ?? 0) > 1 ? "หน่วยงานในความดูแล" : "รายการทรัพย์สิน",
              icon: "package",
              group: "overview",
            },
          ];
        })
      : baseItems;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-white/10 px-5 py-5">
        <p className="font-mono text-xs font-semibold tracking-[0.18em] text-white/70">ATACS</p>
        <p className="mt-1 text-sm font-semibold text-white">ทะเบียนทรัพย์สินและครุภัณฑ์</p>
        <p className="mt-0.5 text-xs text-white/70">สป. จังหวัดสตูล</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 text-white">
        {APP_MENU_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.key} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold text-white/55">{group.label}</p>
              <div className="space-y-0.5">
                {groupItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    pendingRegistrationCount={pendingRegistrationCount}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {user.role !== "officer" && (
          <>
            <div className="my-3 h-px bg-white/10" />

            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition hover:bg-white/10 hover:text-white/70"
            >
              <AppIcon name="globe" className="w-4 shrink-0" />
              หน้าข้อมูลสาธารณะ
            </Link>
          </>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl sidebar-gradient text-white shadow-md ring-1 ring-white/20 lg:hidden"
        aria-label="เปิดเมนู"
      >
        <AppIcon name="menu" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[82vw] max-w-80 sidebar-gradient transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="ปิดเมนู"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
        >
          <AppIcon name="close" />
        </button>
        {sidebarContent}
      </div>

      {/* Desktop sidebar (static) */}
      <aside className="hidden w-60 shrink-0 sidebar-gradient lg:flex lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
