import Link from "next/link";

import { StatusBadge } from "@/app/_components/ui/status-badge";

export type LinkBarRow = {
  key: string;
  label: string;
  count: number;
  color: string;
  href?: string;
  active?: boolean;
  badge?: { text: string; tone: "success" | "warning" | "danger" | "info" | "neutral" };
};

const numberFormat = new Intl.NumberFormat("th-TH");

/**
 * แถบแนวนอนพร้อมจำนวนและร้อยละ กดแถบเพื่อกรองตาราง (ถ้ามี href)
 * ตัวเลขแสดงเป็นข้อความทุกแถว แถบแต่ละแถบมี role="img" + aria-label สำหรับโปรแกรมอ่านหน้าจอ
 */
export function LinkBars({ rows, unit = "เครื่อง", emptyText = "ยังไม่มีข้อมูล" }: { rows: LinkBarRow[]; unit?: string; emptyText?: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(0, ...rows.map((row) => row.count));
  if (total === 0) return <p className="py-6 text-center text-sm text-[var(--muted)]">{emptyText}</p>;

  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const percent = Math.round((row.count / total) * 100);
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate" title={row.label}>{row.label}</span>
                {row.badge && <StatusBadge tone={row.badge.tone} className="shrink-0 px-2 text-[10px]">{row.badge.text}</StatusBadge>}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-[var(--foreground)]">{numberFormat.format(row.count)}</span>{" "}
                <span className="text-xs text-[var(--muted)]">({percent}%)</span>
              </span>
            </span>
            <span
              role="img"
              aria-label={`${row.label} ${numberFormat.format(row.count)} ${unit} (${percent}%)`}
              className="mt-1 block h-2.5 overflow-hidden rounded-full bg-slate-100"
            >
              <span className="block h-full rounded-full" style={{ width: `${max ? Math.max((row.count / max) * 100, 2) : 0}%`, background: row.color }} />
            </span>
          </>
        );
        const base = "block rounded-lg px-2 py-1.5";
        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                aria-current={row.active ? "true" : undefined}
                className={`${base} transition hover:bg-[var(--primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] ${row.active ? "bg-[var(--primary-soft)] ring-1 ring-[var(--primary-soft-strong)]" : ""}`}
              >
                {body}
              </Link>
            ) : (
              <div className={base}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
