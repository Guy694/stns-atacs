"use client";

import Image from "next/image";
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
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-[var(--primary-soft)] text-[var(--accent-strong)]"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <AppIcon name={item.icon} className={`w-4 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-slate-400 group-hover:text-slate-600"}`} />
      <span className="flex-1">{item.label}</span>
      {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
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
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-4">
        <Image
          src="/logo.png"
          alt="ตราสัญลักษณ์ ATACS"
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl border border-[var(--line)] bg-white object-contain p-1"
          priority
        />
        <div className="min-w-0">
          <p className="text-base font-bold tracking-[0.08em] text-[var(--accent-strong)]">ATACS</p>
          <p className="truncate text-xs font-medium text-slate-600">ระบบทะเบียนครุภัณฑ์</p>
          <p className="truncate text-[11px] text-slate-500">สสจ. จังหวัดสตูล</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="เมนูหลัก">
        {APP_MENU_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.key} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold text-slate-400">{group.label}</p>
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
            <div className="my-3 h-px bg-[var(--line)]" />

            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
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
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] text-white shadow-md lg:hidden"
        aria-label="เปิดเมนู"
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation"
      >
        <AppIcon name="menu" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="เมนูนำทาง"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[82vw] max-w-80 border-r border-[var(--line)] bg-white shadow-xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="ปิดเมนู"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <AppIcon name="close" />
        </button>
        {sidebarContent}
      </div>

      {/* Desktop sidebar (static) */}
      <aside className="hidden w-64 shrink-0 bg-[var(--background)] p-3 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="h-full overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
