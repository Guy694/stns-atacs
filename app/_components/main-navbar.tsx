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
    // แถบบนสีน้ำเงินติดหัวจอทุกขนาด สูงเท่าส่วนหัวของ sidebar (76px บนจอใหญ่) จึงต่อกันเป็นกรอบเดียว
    <header className="sticky top-0 z-30 border-b border-[var(--nav-line)] bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] text-white shadow-[0_2px_8px_rgba(8,58,99,0.18)]">
      <div className="flex min-h-[3.75rem] items-center justify-between gap-2 px-3 py-1.5 sm:gap-3 sm:px-6 lg:h-[76px] lg:px-8 lg:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <MobileMenuButton />
          {/* โลโก้อยู่ใน sidebar แล้วบนจอใหญ่ จึงแสดงเฉพาะจอเล็กที่ sidebar ถูกซ่อน */}
          <Image
            src={withBasePath("/logo.png")}
            alt="ATACS Logo"
            width={42}
            height={42}
            className="hidden h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 min-[400px]:block lg:hidden"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-[var(--nav-muted)]">{APP_SHORT}</p>
            <p className="truncate text-sm font-semibold text-white sm:hidden">{APP_NAME.replace(/^ระบบ/, "")}</p>
            <p className="hidden truncate text-sm font-semibold text-white sm:block sm:text-base">{APP_NAME} จังหวัดสตูล</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          {/* จอเล็กแสดงชื่อผู้ใช้ไว้ในเมนู (drawer) แทน เพื่อให้แถบบนเหลือแถวเดียว */}
          <div className="hidden min-w-0 items-center gap-2 rounded-full bg-[var(--nav-hover)] py-1.5 pl-3 pr-1.5 text-xs sm:inline-flex">
            <span className="truncate font-semibold text-white">{user.fullName}</span>
            <span className="rounded-full bg-[var(--brand-green)] px-2 py-0.5 font-medium text-white">{roleLabel(user.role)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/profile"
              aria-label="โปรไฟล์ของฉัน"
              title="โปรไฟล์ของฉัน"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white transition-colors duration-200 hover:bg-[var(--nav-hover)]"
            >
              <AppIcon name="user" className="h-[18px] w-[18px]" />
            </Link>
            <LogoutConfirmForm
              buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white transition-colors duration-200 hover:bg-[var(--state-danger-bg)] hover:text-[var(--state-danger-fg)]"
              ariaLabel="ออกจากระบบ"
              title="ออกจากระบบ"
              buttonContent={
                <AppIcon name="logout" className="h-[18px] w-[18px]" />
              }
            />
          </div>
        </div>
      </div>
    </header>
  );
}
