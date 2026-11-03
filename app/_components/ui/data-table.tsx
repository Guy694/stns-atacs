// Sortable column header and pagination bar shared by every list table.
// No hooks: works in server pages (URL links via `href`/`hrefFor`) and in client components
// (`onSort`/`onPage`, usually from useTableState).
import Link from "next/link";
import type { ReactNode } from "react";

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
      <span aria-hidden="true" className={`text-[10px] leading-none ${dir ? "opacity-100" : "opacity-30 group-hover:opacity-70"}`}>
        {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
      </span>
      <span className="sr-only">{dir === "asc" ? "(เรียงจากน้อยไปมาก)" : dir === "desc" ? "(เรียงจากมากไปน้อย)" : "(กดเพื่อเรียง)"}</span>
    </>
  );
  return (
    <th aria-sort={ariaSort} className={`${className} ${alignClass[align]}`}>
      {href ? (
        <Link href={href} scroll={false} className={control}>{content}</Link>
      ) : (
        <button type="button" onClick={() => onSort?.(sortKey)} className={control}>{content}</button>
      )}
    </th>
  );
}

const buttonBase = "min-w-10 rounded-xl px-3 py-2 text-center text-sm font-medium transition";
const idle = `${buttonBase} border border-black/10 bg-white/80 hover:bg-white`;
const current = `${buttonBase} bg-[var(--accent-strong)] text-white`;
const disabled = `${buttonBase} border border-black/6 bg-white/50 text-[var(--muted)] opacity-60`;

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
    <nav aria-label={label} className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        แสดง {start.toLocaleString("th-TH")}–{end.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ
        {totalPages > 1 && <> · หน้า {page.toLocaleString("th-TH")} จาก {totalPages.toLocaleString("th-TH")}</>}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {page > 1 ? go(page - 1, "ก่อนหน้า") : <span aria-disabled="true" className={disabled}>ก่อนหน้า</span>}
          {pageWindow(page, totalPages).map((value, index) =>
            value === 0 ? (
              <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-sm text-[var(--muted)]">…</span>
            ) : (
              <span key={value}>{go(value, value.toLocaleString("th-TH"), `หน้า ${value}`, value === page)}</span>
            )
          )}
          {page < totalPages ? go(page + 1, "ถัดไป") : <span aria-disabled="true" className={disabled}>ถัดไป</span>}
        </div>
      )}
    </nav>
  );
}
