import Image from "next/image";
import Link from "next/link";

import { LogoutConfirmForm } from "@/app/_components/logout-confirm-form";
import { AppIcon } from "@/app/_components/ui/icon";
import { APP_NAME, APP_ORG, roleLabel } from "@/lib/app-brand";
import { withBasePath } from "@/lib/base-path";

type TopNavigationProps = {
  current: "public" | "internal" | "assets" | "admin" | "profile" | "login" | "register";
  user?: {
    id?: number;
    fullName: string;
    role: "admin" | "officer" | "viewer";
  } | null;
};

function navItemClass(isActive: boolean) {
  return [
    "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors duration-200",
    isActive ? "bg-white text-[var(--nav-bg)] font-semibold" : "text-[var(--nav-muted)] hover:bg-[var(--nav-hover)] hover:text-white",
  ].join(" ");
}

/** Header for pages outside the signed-in shell (public dashboard, register, pending approval). */
export function TopNavigation({ current, user }: TopNavigationProps) {
  return (
    <header className="rounded-2xl bg-[var(--nav-bg)] px-4 py-3 text-white shadow-[0_2px_8px_rgba(8,58,99,0.18)] sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl" aria-label={`${APP_NAME} ${APP_ORG} — หน้าแรก`}>
          <Image
            src={withBasePath("/logo.png")}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1"
            priority
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white sm:text-base">{APP_NAME}</span>
            <span className="block truncate text-xs text-[var(--nav-muted)]">{APP_ORG}</span>
          </span>
        </Link>

        {user ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard" aria-current={current === "internal" ? "page" : undefined} className={navItemClass(current === "internal")}>
              แดชบอร์ด
            </Link>
            <Link href="/assets" aria-current={current === "assets" ? "page" : undefined} className={navItemClass(current === "assets")}>
              ทะเบียนทรัพย์สิน
            </Link>
            {user.role === "admin" && (
              <Link href="/admin/users" aria-current={current === "admin" ? "page" : undefined} className={navItemClass(current === "admin")}>
                จัดการผู้ใช้
              </Link>
            )}
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--nav-hover)] py-1.5 pl-3 pr-1.5 text-xs">
              <span className="font-semibold text-white">{user.fullName}</span>
              <span className="rounded-full bg-[var(--brand-green)] px-2 py-0.5 font-medium text-white">{roleLabel(user.role)}</span>
            </div>
            <Link
              href="/profile"
              aria-current={current === "profile" ? "page" : undefined}
              aria-label="โปรไฟล์ของฉัน"
              title="โปรไฟล์ของฉัน"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-colors duration-200 ${current === "profile" ? "border-transparent bg-white text-[var(--nav-bg)]" : "border-transparent text-white hover:bg-[var(--nav-hover)]"}`}
            >
              <AppIcon name="user" className="h-4 w-4" />
            </Link>
            <LogoutConfirmForm
              buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-[var(--state-danger-bg)] hover:text-[var(--state-danger-fg)]"
              ariaLabel="ออกจากระบบ"
              title="ออกจากระบบ"
              buttonContent={<AppIcon name="logout" className="h-4 w-4" />}
            />
          </div>
        ) : (
          // ผู้เยี่ยมชม: ปุ่มทั้งหมดอยู่ที่แถบบนจุดเดียว (ไม่ซ้ำกับส่วนหัวของหน้า)
          <div className="flex shrink-0 items-center gap-2">
            {current !== "register" && (
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/50 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--nav-hover)]"
              >
                <AppIcon name="user" className="h-4 w-4" />
                ลงทะเบียน
              </Link>
            )}
            {current !== "login" && (
              <Link href="/login" className="primary-action shrink-0 !bg-[var(--brand-green)] hover:!bg-[var(--brand-green-strong)]">
                <AppIcon name="key" className="h-4 w-4" />
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
