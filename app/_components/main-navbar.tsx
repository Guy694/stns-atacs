import Image from "next/image";
import Link from "next/link";

import { LogoutConfirmForm } from "@/app/_components/logout-confirm-form";
import { AppIcon } from "@/app/_components/ui/icon";

type MainNavbarProps = {
  user: {
    fullName: string;
    role: "admin" | "officer" | "viewer";
  };
};

export function MainNavbar({ user }: MainNavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 px-3 py-2.5 pl-16 backdrop-blur-sm sm:px-6 sm:pl-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.png"
            alt="ATACS Logo"
            width={42}
            height={42}
            className="h-9 w-9 rounded-xl border border-[var(--line)] bg-white object-contain p-1 sm:h-10 sm:w-10"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold tracking-[0.16em] text-[var(--accent-strong)] uppercase">ATACS</p>
            <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:hidden">ทะเบียนทรัพย์สินและครุภัณฑ์</p>
            <p className="hidden truncate text-sm font-semibold text-[var(--foreground)] sm:block sm:text-base">ทะเบียนทรัพย์สินและครุภัณฑ์ สป. จังหวัดสตูล</p>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <div className="inline-flex min-w-0 max-w-[58vw] items-center gap-2 rounded-full border border-[var(--line)] bg-slate-50 px-3 py-1.5 text-xs text-[var(--muted)] sm:max-w-none sm:py-2">
            <span className="truncate font-semibold text-[var(--accent-strong)]">{user.fullName}</span>
            <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 uppercase tracking-[0.12em] text-[var(--primary-text)]">{user.role}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              aria-label="โปรไฟล์"
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--primary-soft)] sm:px-4 sm:py-2"
            >
              <AppIcon name="users" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">โปรไฟล์</span>
            </Link>
            <LogoutConfirmForm
              buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--accent-strong)] transition hover:bg-[var(--primary-soft)]"
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
