import Link from "next/link";

import { LogoutConfirmForm } from "@/app/_components/logout-confirm-form";

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
    "rounded-full px-4 py-2 text-sm font-medium transition text-white",
    isActive ? "bg-[var(--accent-strong)] text-white" : "bg-white/70 text-[var(--accent-strong)] hover:bg-white",
  ].join(" ");
}

export function TopNavigation({ current, user }: TopNavigationProps) {
  return (
    <div className="glass-panel rounded-[1.6rem] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/public" className={navItemClass(current === "public")}>
            Public Dashboard
          </Link>
          {user ? (
            <>
              <Link href="/" className={navItemClass(current === "internal")}>
                Dashboard
              </Link>
              <Link href="/assets" className={navItemClass(current === "assets")}>
                ทะเบียนทรัพย์สิน
              </Link>
              {user.role === "admin" && (
                <Link href="/admin/users" className={navItemClass(current === "admin")}>
                  จัดการผู้ใช้
                </Link>
              )}
            </>
          ) : (
            <Link href="/login" className={navItemClass(current === "login" || current === "register")}>
              Login / Register
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user ? (
            <>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs text-[var(--muted)]">
                <span className="font-semibold text-[var(--accent-strong)]">{user.fullName}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 uppercase tracking-[0.16em]">{user.role}</span>
              </div>
              <Link
                href="/profile"
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                  current === "profile"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-black/10 bg-white/70 text-[var(--muted)] hover:bg-white"
                }`}
              >
                โปรไฟล์
              </Link>
              <LogoutConfirmForm buttonClassName="rounded-full border border-black/12 bg-white/75 px-4 py-2 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-white" />
            </>
          ) : (
            <div className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs text-[var(--muted)]">
              Public view แสดงเฉพาะข้อมูลสรุประดับจังหวัด
            </div>
          )}
        </div>
      </div>
    </div>
  );
}