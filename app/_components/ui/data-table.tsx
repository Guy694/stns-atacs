// Sortable column header and pagination bar shared by every list table.
// No hooks: works in server pages (URL links via `href`/`hrefFor`) and in client components
// (`onSort`/`onPage`, usually from useTableState).
import Link from "next/link";
import type { ReactNode } from "react";

import { AppIcon } from "@/app/_components/ui/icon";
import { pageWindow, type SortState } from "@/lib/table-sort";

type Align = "left" | "right" | "center";

const alignClass: Record<Align, string> = { left: "text-left", right: "text-right", center: "text-center" };

export function SortableTh({
  label,
  sortKey,
  sort,
  href,
  onSort,
  align = "left",
  className = "px-4 py-2.5 font-medium",
}: {
  label: ReactNode;
  sortKey: string;
  sort: SortState | null;
  href?: string;
  onSort?: (key: string) => void;
  align?: Align;
  className?: string;
}) {
  const dir = sort?.key === sortKey ? sort.dir : null;
  const ariaSort = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
  const control = `group inline-flex items-center gap-1 rounded-md transition hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
    align === "right" ? "flex-row-reverse" : ""
  } ${dir ? "font-semibold text-[var(--foreground)]" : ""}`;
  const content = (
    <>
      <span>{label}</span>
      <AppIcon
        name={dir === "asc" ? "chevron-down" : dir === "desc" ? "chevron-down" : "chevrons-up-down"}
        size={13}
        className={`shrink-0 transition ${dir === "asc" ? "rotate-180" : ""} ${dir ? "opacity-100" : "opacity-35 group-hover:opacity-70"}`}
      />
      <span className="sr-only">{dir === "asc" ? "(เรียงจากน้อยไปมาก)" : dir === "desc" ? "(เรียงจากมากไปน้อย)" : "(กดเพื่อเรียง)"}</span>
    </>
  );
  return (
    <th aria-sort={ariaSort} className={`relative ${className} ${alignClass[align]}`}>
      {href ? (
        <Link href={href} scroll={false} className={control}>{content}</Link>
      ) : (
        <button type="button" onClick={() => onSort?.(sortKey)} className={control}>{content}</button>
      )}
    </th>
  );
}

// Compact on purpose: 32px targets (≥24px WCAG 2.2 minimum) so the bar never dominates the table.
const buttonBase = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const idle = `${buttonBase} border border-black/10 bg-white/80 text-[var(--foreground)] hover:border-[var(--primary-soft-strong)] hover:bg-[var(--primary-soft)]`;
const current = `${buttonBase} bg-[var(--accent-strong)] text-white`;
const disabled = `${buttonBase} border border-black/6 bg-white/40 text-[var(--muted)] opacity-50`;

export function TablePagination({
  page,
  totalPages,
  total,
  start,
  end,
  hrefFor,
  onPage,
  label = "แบ่งหน้ารายการ",
  className = "",
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  hrefFor?: (page: number) => string;
  onPage?: (page: number) => void;
  label?: string;
  className?: string;
}) {
  if (total === 0) return null;

  const go = (target: number, text: ReactNode, aria?: string, isCurrent = false) =>
    hrefFor ? (
      <Link href={hrefFor(target)} scroll={false} aria-label={aria} aria-current={isCurrent ? "page" : undefined} className={isCurrent ? current : idle}>
        {text}
      </Link>
    ) : (
      <button type="button" onClick={() => onPage?.(target)} aria-label={aria} aria-current={isCurrent ? "page" : undefined} className={isCurrent ? current : idle}>
        {text}
      </button>
    );

  return (
    <nav aria-label={label} className={`flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-xs text-[var(--muted)] tabular-nums" aria-live="polite">
        แสดง {start.toLocaleString("th-TH")}–{end.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ
        {totalPages > 1 && <> · หน้า {page.toLocaleString("th-TH")} จาก {totalPages.toLocaleString("th-TH")}</>}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {page > 1 ? go(page - 1, <AppIcon name="chevron-left" size={16} />, "หน้าก่อนหน้า") : <span aria-disabled="true" className={disabled}><AppIcon name="chevron-left" size={16} /></span>}
          {pageWindow(page, totalPages).map((value, index) =>
            value === 0 ? (
              <span key={`gap-${index}`} aria-hidden="true" className="px-0.5 text-xs text-[var(--muted)]">…</span>
            ) : (
              <span key={value} className="contents">{go(value, value.toLocaleString("th-TH"), `หน้า ${value}`, value === page)}</span>
            )
          )}
          {page < totalPages ? go(page + 1, <AppIcon name="chevron-right" size={16} />, "หน้าถัดไป") : <span aria-disabled="true" className={disabled}><AppIcon name="chevron-right" size={16} /></span>}
        </div>
      )}
    </nav>
  );
}
