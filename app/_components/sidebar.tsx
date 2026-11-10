"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { setMobileMenuOpen, useMobileMenuOpen } from "@/app/_components/mobile-menu-store";
import { activeHrefFor, buildNavItems, type NavItem, type NavUser } from "@/app/_components/nav-items";
import { AppIcon } from "@/app/_components/ui/icon";
import { APP_MENU_GROUPS } from "@/lib/menu";
import { withBasePath } from "@/lib/base-path";
import { APP_NAME, roleLabel } from "@/lib/app-brand";

type SidebarProps = {
  user: NavUser;
  grantedPermissions: string[];
  pendingRegistrationCount: number;
  menuVisibility: Record<string, boolean>;
};

/** Opens the mobile drawer; rendered inside the sticky mobile navbar so nothing floats over page content. */
export function MobileMenuButton() {
  const mobileOpen = useMobileMenuOpen();
  return (
    <button
      type="button"
      onClick={() => setMobileMenuOpen(true)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--nav-hover)] text-white transition-colors duration-200 hover:bg-white/20 lg:hidden"
      aria-label="เปิดเมนู"
      title="เปิดเมนู"
      aria-expanded={mobileOpen}
      aria-controls="mobile-navigation"
    >
      <AppIcon name="menu" />
    </button>
  );
}

function NavLink({
  item,
  activeHref,
  pendingRegistrationCount,
  onClick,
}: {
  item: NavItem;
  activeHref: string | null;
  pendingRegistrationCount: number;
  onClick?: () => void;
}) {
  const isActive = item.href === activeHref;
  const badgeCount = item.href === "/admin/users" ? pendingRegistrationCount : 0;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-white font-semibold text-[var(--nav-bg)] shadow-sm"
          : "text-[var(--nav-muted)] hover:bg-[var(--nav-hover)] hover:text-white"
      }`}
    >
      <AppIcon name={item.icon} className={`w-4 shrink-0 ${isActive ? "text-[var(--brand-green)]" : "text-[var(--nav-subtle)] group-hover:text-white"}`} />
      <span className="flex-1">{item.label}</span>
      {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-green)]" aria-hidden="true" />}
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
  const mobileOpen = useMobileMenuOpen();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Navigating (link click, back/forward) closes the drawer.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // The drawer only exists below lg; growing the window past it must not leave the page scroll-locked.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) setMobileMenuOpen(false);
    };
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      // Keep keyboard focus inside the modal drawer.
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // Another layer on top (e.g. a SweetAlert dialog) owns focus: leave it alone.
      if (active && active !== document.body && !drawerRef.current.contains(active)) return;
      const outside = active === document.body;
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [mobileOpen]);

  const items = buildNavItems({ user, grantedPermissions, menuVisibility });

  const activeHref = activeHrefFor(items, pathname);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      {/* Exactly as tall as the navbar (76px + 1px border) so the two bottom lines meet. */}
      <div className="flex h-[77px] shrink-0 items-center gap-3 border-b border-[var(--nav-line)] pl-4 pr-16 lg:pr-4">
        <Image
          src={withBasePath("/logo.png")}
          alt="ตราสัญลักษณ์ ATACS"
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-sm"
          priority
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-base font-bold tracking-[0.08em] text-white">
            ATACS
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" aria-hidden="true" />
          </p>
          <p className="truncate text-xs font-medium text-[var(--nav-muted)]" title={APP_NAME}>{APP_NAME}</p>
          <p className="truncate text-[11px] text-[var(--nav-subtle)]">สสจ. จังหวัดสตูล</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="nav-scroll flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="เมนูหลัก">
        {APP_MENU_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.key} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold text-[var(--nav-subtle)]">{group.label}</p>
              <div className="space-y-0.5">
                {groupItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    activeHref={activeHref}
                    pendingRegistrationCount={pendingRegistrationCount}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {user.role !== "officer" && (
          <>
            <div className="my-3 h-px bg-[var(--nav-line)]" />

            <Link
              href="/public"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[var(--nav-muted)] transition hover:bg-[var(--nav-hover)] hover:text-white"
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
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        ref={drawerRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="เมนูนำทาง"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[82vw] max-w-80 bg-[var(--nav-bg)] text-white shadow-xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="ปิดเมนู"
          title="ปิดเมนู"
          className="absolute right-3 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--nav-muted)] transition-colors duration-200 hover:bg-[var(--nav-hover)] hover:text-white"
        >
          <AppIcon name="close" />
        </button>
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">{sidebarContent}</div>
          {/* ชื่อผู้ใช้ซ่อนจากแถบบนในจอเล็ก จึงแสดงไว้ท้ายเมนูแทน */}
          <div className="border-t border-[var(--nav-line)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs text-[var(--nav-muted)]">
            <p className="truncate font-semibold text-white">{user.fullName}</p>
            <p className="mt-0.5">{roleLabel(user.role)}</p>
          </div>
        </div>
      </div>

      {/* Desktop sidebar (static) */}
      <aside className="hidden w-64 shrink-0 bg-[var(--nav-bg)] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
