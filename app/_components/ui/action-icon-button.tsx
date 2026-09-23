import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";

/**
 * ปุ่มไอคอนสำหรับแถวรายการ (แก้ไข / ลบ ฯลฯ) — ใช้ทั่วทั้งระบบเพื่อให้หน้าตาเหมือนกัน
 * ต้องส่ง `label` เสมอ เพราะใช้เป็นทั้ง aria-label (โปรแกรมอ่านหน้าจอ) และ title (คำอธิบายเมื่อชี้เมาส์)
 * ขนาดขั้นต่ำ 44×44 px ตามเกณฑ์การกดบนมือถือ
 */
const TONES = {
  neutral: "border-black/10 bg-white/80 text-[var(--accent-strong)] hover:bg-white",
  primary: "border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] text-[var(--primary-text)] hover:bg-[var(--primary-soft-strong)]",
  danger: "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
} as const;

export type ActionIconTone = keyof typeof TONES;

export function actionIconClass(tone: ActionIconTone = "neutral", extra = "") {
  return `inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]} ${extra}`.trim();
}

type ActionIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  label: string;
  tone?: ActionIconTone;
  /** แสดงข้อความข้างไอคอนด้วย (ใช้เมื่อพื้นที่พอ เช่น ปุ่มเดี่ยวบนมือถือ) */
  showLabel?: boolean;
};

export function ActionIconButton({ icon, label, tone = "neutral", showLabel = false, className = "", type = "button", ...props }: ActionIconButtonProps) {
  return (
    <button {...props} type={type} aria-label={label} title={label} className={actionIconClass(tone, `${showLabel ? "gap-2 px-3" : ""} ${className}`)}>
      <AppIcon name={icon} className="h-4 w-4" />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}

export function ActionIconLink({ href, icon, label, tone = "neutral", className = "" }: { href: string; icon: IconName; label: string; tone?: ActionIconTone; className?: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={actionIconClass(tone, className)}>
      <AppIcon name={icon} className="h-4 w-4" />
    </Link>
  );
}
