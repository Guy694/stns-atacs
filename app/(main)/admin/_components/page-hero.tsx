import type { ReactNode } from "react";
import Link from "next/link";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { PhotoBackdrop, type BackdropImage } from "@/app/_components/ui/photo-backdrop";

/**
 * หัวหน้าสำหรับหน้าผู้ดูแลระบบ / Agent Monitor / คู่มือ / โปรไฟล์ — รูปแบบเดียวกับหน้าตรวจนับ:
 * พื้นขาว เส้นขอบบาง ภาพสำนักงานจาง ๆ ด้านหนึ่ง (ห้ามใช้ภาพหลังตารางหรือฟอร์ม)
 */
export function PageHero({
  title,
  description,
  icon,
  image = "it-storage",
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  image?: BackdropImage;
  /** ปุ่มหลักของหน้า (ไอคอน + ข้อความ) */
  actions?: ReactNode;
  /** ข้อมูลสรุปเพิ่มเติมใต้คำอธิบาย */
  children?: ReactNode;
}) {
  return (
    <header className="relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <PhotoBackdrop image={image} fade="left" />
      <div className="min-w-0">
        <h1 className="section-title flex items-center gap-2.5 text-2xl font-semibold sm:text-3xl">
          {icon && (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-text)]">
              <AppIcon name={icon} size={20} />
            </span>
          )}
          <span className="min-w-0">{title}</span>
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** สถานะว่าง: ภาพจาง ๆ + ไอคอน + ข้อความ (ใช้แทนกล่องเปล่าในรายการ) */
export function EmptyState({
  icon = "info",
  title,
  description,
  image = "office-desk",
  tone = "neutral",
  children,
  className = "",
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  image?: BackdropImage;
  tone?: "neutral" | "success";
  children?: ReactNode;
  className?: string;
}) {
  const iconTone = tone === "success" ? "bg-[var(--state-success-bg)] text-[var(--state-success-fg)]" : "bg-[var(--primary-soft)] text-[var(--primary-text)]";
  return (
    <div className={`relative isolate overflow-hidden px-6 py-12 text-center ${className}`}>
      <PhotoBackdrop image={image} fade="bottom" opacity="opacity-[0.08]" />
      <span className={`mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full ${iconTone}`}>
        <AppIcon name={icon} size={20} />
      </span>
      <p className="font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{description}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

/** เส้นทาง "ตั้งค่าระบบ › หน้าปัจจุบัน" ของหน้าย่อยการตั้งค่า */
export function SettingsBreadcrumb({ current, parent = { href: "/admin/settings", label: "ตั้งค่าระบบ" } }: { current: string; parent?: { href: string; label: string } }) {
  return (
    <nav aria-label="เส้นทาง" className="flex items-center gap-1 text-xs text-[var(--muted)]">
      <Link href={parent.href} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors duration-200 hover:bg-[var(--primary-soft)] hover:text-[var(--primary-text)]">
        <AppIcon name="settings" size={13} />
        {parent.label}
      </Link>
      <AppIcon name="chevron-right" size={13} />
      <span aria-current="page" className="font-medium text-[var(--foreground)]">{current}</span>
    </nav>
  );
}

/** การ์ดตัวเลขสรุป — ภาพจางด้านขวา ตัวเลขอยู่บนพื้นสะอาดด้านซ้าย */
export function SummaryCard({
  label,
  value,
  hint,
  icon,
  image = "office-desk",
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  image?: BackdropImage;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const valueTone =
    tone === "success" ? "text-[var(--state-success-fg)]" : tone === "warning" ? "text-[var(--state-warning-fg)]" : tone === "danger" ? "text-[var(--state-danger-fg)]" : tone === "info" ? "text-[var(--primary-text)]" : "text-[var(--foreground)]";
  return (
    <div className="glass-panel relative isolate overflow-hidden rounded-2xl p-4">
      <PhotoBackdrop image={image} fade="left" opacity="opacity-[0.09]" />
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        {icon && <AppIcon name={icon} size={15} className="text-[var(--primary)]" />}
        <span>{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
