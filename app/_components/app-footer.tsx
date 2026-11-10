import Image from "next/image";
import Link from "next/link";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { APP_NAME, APP_ORG } from "@/lib/app-brand";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import { withBasePath } from "@/lib/base-path";
import { todayBangkok } from "@/lib/local-date";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/manuals", label: "คู่มือการใช้งาน", icon: "file-text" },
  { href: "/scan", label: "สแกน QR", icon: "qr" },
  { href: "/public", label: "ข้อมูลสาธารณะ", icon: "globe" },
];

/** Footer of the signed-in shell: who runs the system, quick help links, version. */
export function AppFooter() {
  const yearBE = Number(todayBangkok().slice(0, 4)) + 543;
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-white">
      <div className="h-[3px] bg-gradient-to-r from-[var(--nav-bg)] via-[var(--primary)] to-[var(--brand-green)]" aria-hidden="true" />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image src={withBasePath("/logo.png")} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="font-semibold text-[var(--nav-bg)]">
              ATACS <span className="font-normal text-[var(--muted)]">· {APP_NAME}</span>
            </p>
            <p className="text-[var(--muted)]">กลุ่มงานสุขภาพดิจิทัล {APP_ORG}</p>
          </div>
        </div>

        <nav aria-label="ลิงก์ช่วยเหลือ" className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--brand-green-soft)] hover:text-[var(--brand-green-text)]"
            >
              <AppIcon name={link.icon} size={14} />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>© {yearBE} สสจ.สตูล</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-green-soft)] bg-[var(--brand-green-soft)] px-2.5 py-1 font-medium tabular-nums text-[var(--brand-green-text)]"
            title="เวอร์ชันของระบบ"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" aria-hidden="true" />
            {APP_VERSION_LABEL}
          </span>
        </div>
      </div>
    </footer>
  );
}
