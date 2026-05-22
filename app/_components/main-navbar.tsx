import Image from "next/image";
import Link from "next/link";

import { LogoutConfirmForm } from "@/app/_components/logout-confirm-form";

type MainNavbarProps = {
  user: {
    fullName: string;
    role: "admin" | "officer" | "viewer";
  };
};

export function MainNavbar({ user }: MainNavbarProps) {
  return (
    <header className="glass-panel mx-4 mt-4 rounded-2xl px-4 py-3 sm:mx-6 sm:px-5 lg:mx-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.png"
            alt="ATACS Logo"
            width={42}
            height={42}
            className="h-10 w-10 rounded-xl border border-black/10 bg-white object-contain p-1"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">ATACS</p>
            <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">ทะเบียนทรัพย์สินสารสนเทศ สป. จังหวัดสตูล</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--accent-strong)]">{user.fullName}</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 uppercase tracking-[0.16em]">{user.role}</span>
          </div>
          <Link
            href="/profile"
            className="rounded-full border border-black/10 bg-white/75 px-4 py-2 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-white"
          >
            โปรไฟล์
          </Link>
          <LogoutConfirmForm buttonClassName="rounded-full border border-black/12 bg-white/75 px-4 py-2 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-white" />
        </div>
      </div>
    </header>
  );
}