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
    isActive ? "bg-[var(--accent-strong)] text-white" : "bg-white text-[var(--accent-strong)] hover:bg-[var(--primary-soft)]",
  ].join(" ");
}

/** Header for pages outside the signed-in shell (public dashboard, register, pending approval). */
export function TopNavigation({ current, user }: TopNavigationProps) {
  return (
    <header className="glass-panel rounded-2xl px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl" aria-label={`${APP_NAME} ${APP_ORG} — หน้าแรก`}>
          <Image
            src={withBasePath("/logo.png")}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl border border-[var(--line)] bg-white object-contain p-1"
            priority
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">{APP_NAME}</span>
            <span className="block truncate text-xs text-[var(--muted)]">{APP_ORG}</span>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--accent-strong)]">{user.fullName}</span>
              <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[var(--primary-text)]">{roleLabel(user.role)}</span>
            </div>
            <Link
              href="/profile"
              aria-current={current === "profile" ? "page" : undefined}
              aria-label="โปรไฟล์ของฉัน"
              title="โปรไฟล์ของฉัน"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-colors duration-200 ${current === "profile" ? "border-transparent bg-[var(--accent-strong)] text-white" : "border-[var(--line)] bg-white text-[var(--accent-strong)] hover:bg-[var(--primary-soft)]"}`}
            >
              <AppIcon name="user" className="h-4 w-4" />
            </Link>
            <LogoutConfirmForm
              buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--accent-strong)] transition-colors duration-200 hover:border-[var(--state-danger-border)] hover:bg-[var(--state-danger-bg)] hover:text-[var(--state-danger-fg)]"
              ariaLabel="ออกจากระบบ"
              title="ออกจากระบบ"
              buttonContent={<AppIcon name="logout" className="h-4 w-4" />}
            />
          </div>
        ) : (
          <Link href="/login" className="primary-action shrink-0">
            <AppIcon name="key" className="h-4 w-4" />
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </header>
  );
}
