import Image from "next/image";
import Link from "next/link";

import { LogoutConfirmForm } from "@/app/_components/logout-confirm-form";
import { MobileMenuButton } from "@/app/_components/sidebar";
import { AppIcon } from "@/app/_components/ui/icon";
import { withBasePath } from "@/lib/base-path";
import { APP_NAME, APP_SHORT, roleLabel } from "@/lib/app-brand";

type MainNavbarProps = {
  user: {
    fullName: string;
    role: "admin" | "officer" | "viewer";
  };
};

export function MainNavbar({ user }: MainNavbarProps) {
  return (
    // แถบบนติดหัวจอ (sticky) ทุกขนาดจอ — ในจอเล็กมีปุ่มเมนูอยู่ในแถบนี้ จึงไม่มีปุ่มลอยทับเนื้อหาเวลาเลื่อน
    <header className="sticky top-0 z-30 bg-[var(--background)]/90 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 backdrop-blur-sm sm:px-6 sm:pt-3 lg:pl-0 lg:pr-3">
      {/* การ์ดเดียวกับ sidebar: มุมโค้ง เส้นขอบ และระยะขอบบนเท่ากัน สูงเท่าส่วนหัวของ sidebar เพื่อให้เส้นล่างต่อกัน */}
      <div className="flex min-h-[3.75rem] items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:gap-3 sm:px-5 sm:py-2 lg:min-h-[76px] lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <MobileMenuButton />
          {/* โลโก้อยู่ใน sidebar แล้วบนจอใหญ่ จึงแสดงเฉพาะจอเล็กที่ sidebar ถูกซ่อน */}
          <Image
            src={withBasePath("/logo.png")}
            alt="ATACS Logo"
            width={42}
            height={42}
            className="hidden h-10 w-10 shrink-0 rounded-xl border border-[var(--line)] bg-white object-contain p-1 min-[400px]:block lg:hidden"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-[var(--accent-strong)]">{APP_SHORT}</p>
            <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:hidden">{APP_NAME.replace(/^ระบบ/, "")}</p>
            <p className="hidden truncate text-sm font-semibold text-[var(--foreground)] sm:block sm:text-base">{APP_NAME} จังหวัดสตูล</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          {/* จอเล็กแสดงชื่อผู้ใช้ไว้ในเมนู (drawer) แทน เพื่อให้แถบบนเหลือแถวเดียว */}
          <div className="hidden min-w-0 items-center gap-2 rounded-full border border-[var(--line)] bg-slate-50 px-3 py-2 text-xs text-[var(--muted)] sm:inline-flex">
            <span className="truncate font-semibold text-[var(--accent-strong)]">{user.fullName}</span>
            <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[var(--primary-text)]">{roleLabel(user.role)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              aria-label="โปรไฟล์ของฉัน"
              title="โปรไฟล์ของฉัน"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--accent-strong)] transition-colors duration-200 hover:bg-[var(--primary-soft)]"
            >
              <AppIcon name="user" className="h-4 w-4" />
            </Link>
            <LogoutConfirmForm
              buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--accent-strong)] transition-colors duration-200 hover:border-[var(--state-danger-border)] hover:bg-[var(--state-danger-bg)] hover:text-[var(--state-danger-fg)]"
              ariaLabel="ออกจากระบบ"
              title="ออกจากระบบ"
              buttonContent={
                <AppIcon name="logout" className="h-4 w-4" />
              }
            />
          </div>
        </div>
      </div>
    </header>
  );
}
