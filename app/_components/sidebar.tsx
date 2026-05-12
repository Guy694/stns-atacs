"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { logoutAction } from "@/app/auth/actions";

type NavUser = {
  fullName: string;
  role: "admin" | "officer";
};

type SidebarProps = {
  user: NavUser;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "◈", exact: true },
  { href: "/assets", label: "ทะเบียนทรัพย์สิน", icon: "◫" },
  { href: "/facilities", label: "หน่วยบริการ", icon: "◧" },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: "◉", adminOnly: true },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-white/20 text-white shadow-sm ring-1 ring-white/25"
          : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base leading-none">{item.icon}</span>
      {item.label}
    </Link>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin");

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-white/10 px-5 py-5">
        <p className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">ATACS</p>
        <p className="mt-0.5 text-base font-semibold text-white">จ.สตูล</p>
        <p className="mt-0.5 text-xs text-white/45">ทะเบียนทรัพย์สินสารสนเทศ</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileOpen(false)} />
        ))}

        <div className="my-3 h-px bg-white/10" />

        <Link
          href="/public"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition hover:bg-white/10 hover:text-white/70"
        >
          <span className="text-base leading-none">◌</span>
          Public Dashboard
        </Link>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
            pathname === "/profile" ? "bg-white/15" : "hover:bg-white/10"
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            {user.fullName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
            <p className="text-xs text-white/40 uppercase tracking-wider">{user.role}</p>
          </div>
        </Link>
        <form action={logoutAction} className="mt-1">
          <button
            type="submit"
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-white/40 transition hover:bg-white/10 hover:text-white/70"
          >
            ออกจากระบบ →
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-xl sidebar-gradient text-white shadow-lg lg:hidden"
        aria-label="เปิดเมนู"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="4" width="14" height="1.5" rx="0.75" fill="currentColor" />
          <rect x="2" y="8.25" width="10" height="1.5" rx="0.75" fill="currentColor" />
          <rect x="2" y="12.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
        </svg>
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
        className={`fixed inset-y-0 left-0 z-50 w-64 sidebar-gradient transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
        >
          ✕
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
