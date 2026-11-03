"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { setMobileMenuOpen, useMobileMenuOpen } from "@/app/_components/mobile-menu-store";
import { activeHrefFor, buildNavItems, type NavItem, type NavUser } from "@/app/_components/nav-items";
import { AppIcon, type IconName } from "@/app/_components/ui/icon";

type Props = {
  user: NavUser;
  grantedPermissions: string[];
  menuVisibility: Record<string, boolean>;
};

/** QR glyph for the scan button (AppIcon has no QR icon). */
function QrIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </svg>
  );
}

function BarLink({ item, label, icon, active }: { item: NavItem; label: string; icon: IconName; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors ${
        active ? "text-[var(--accent-strong)]" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-[var(--primary-soft)]" : ""}`}>
        <AppIcon name={icon} className="h-5 w-5" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

/**
 * แถบนำทางด้านล่างสำหรับโทรศัพท์ (ซ่อนบนจอใหญ่ที่มี sidebar)
 * ใช้กฎการแสดงเมนูชุดเดียวกับ sidebar (buildNavItems) — เมนูที่ถูกปิดหรือไม่มีสิทธิ์จะไม่แสดงที่นี่เช่นกัน
 * ปุ่ม "สแกน" ไปที่หน้าตรวจนับ ซึ่งเป็นที่เดียวที่มีการสแกน QR ในระบบ (เลือกรอบตรวจนับแล้วสแกน)
 */
export function MobileBottomNav({ user, grantedPermissions, menuVisibility }: Props) {
  const pathname = usePathname();
  const menuOpen = useMobileMenuOpen();
  const items = buildNavItems({ user, grantedPermissions, menuVisibility });
  const activeHref = activeHrefFor(items, pathname);
  const find = (key: string) => items.find((item) => item.key === key);

  const dashboard = find("dashboard");
  const assets = find(user.role === "officer" ? "officer-assets" : "assets");
  const inspection = find("inspection");

  return (
    <nav
      aria-label="เมนูลัด"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-sm lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-end gap-1">
        {dashboard && <BarLink item={dashboard} label="ภาพรวม" icon="activity" active={activeHref === dashboard.href} />}
        {assets && <BarLink item={assets} label="ทรัพย์สิน" icon="package" active={activeHref === assets.href} />}
        {inspection && (
          <Link
            href={inspection.href}
            aria-label="สแกน QR ตรวจนับทรัพย์สิน"
            className="flex min-h-14 flex-1 flex-col items-center justify-end gap-0.5 pb-1 text-[11px] font-semibold text-[var(--accent-strong)]"
          >
            <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[var(--accent-strong)] text-white shadow-md">
              <QrIcon className="h-6 w-6" />
            </span>
            <span aria-hidden="true">สแกน</span>
          </Link>
        )}
        {inspection && <BarLink item={inspection} label="ตรวจนับ" icon="clipboard-check" active={activeHref === inspection.href} />}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="เปิดเมนูทั้งหมด"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <AppIcon name="menu" className="h-5 w-5" />
          </span>
          <span aria-hidden="true">เมนู</span>
        </button>
      </div>
    </nav>
  );
}
