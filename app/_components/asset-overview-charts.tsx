import Link from "next/link";

import { DASHBOARD_STATUSES, type DashboardSummary } from "@/lib/dashboard-summary";
import { baht, hrefWith, numberFormat, percent, Tip } from "@/app/_components/overview-format";

export { baht, compactBaht, hrefWith, numberFormat, percent } from "@/app/_components/overview-format";
export { DistrictComparison } from "@/app/_components/district-comparison";

// Single-hue magnitude colour (sequential blue) and chart chrome from the shared data-viz palette.
const BAR = "#2a78d6";
const BAR_MUTED = "#86b6ef";
const TRACK = "#eef3f8";



export function Panel({ id, title, subtitle, children, action }: { id: string; title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={id} className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value, unit, detail, href }: { label: string; value: string; unit: string; detail: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-bold leading-none text-[var(--foreground)]">{value}</span>
        <span className="text-sm text-[var(--muted)]">{unit}</span>
      </p>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{detail}</p>
    </>
  );
  const className = "block min-w-0 rounded-2xl border border-[var(--line)] bg-white p-5";
  return href
    ? <Link href={href} className={`${className} transition hover:border-[var(--primary-soft-strong)] hover:bg-[var(--primary-soft)]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}>{body}</Link>
    : <div className={className}>{body}</div>;
}

export function StatusDonut({ summary }: { summary: DashboardSummary }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const visible = summary.statuses.filter((status) => status.count > 0);
  const gap = visible.length > 1 ? 2 : 0; // 2px surface gap between segments
  const offsets = visible.map((_, index) => visible.slice(0, index).reduce((sum, status) => sum + status.share * circumference, 0));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" className="h-44 w-44 shrink-0" role="img" aria-label={`สถานะการใช้งาน: ${visible.map((s) => `${s.label} ${s.count} รายการ`).join(", ") || "ไม่มีข้อมูล"}`}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke={TRACK} strokeWidth="20" />
        {visible.map((status, index) => {
          const length = status.share * circumference;
          const dash = Math.max(length - gap, 0.5);
          return (
            <circle key={status.value} cx="80" cy="80" r={radius} fill="none" stroke={status.color} strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offsets[index]} transform="rotate(-90 80 80)">
              <title>{`${status.label}: ${numberFormat.format(status.count)} รายการ (${percent(status.share)})`}</title>
            </circle>
          );
        })}
        <text x="80" y="78" textAnchor="middle" className="fill-[#0b0b0b] text-[26px] font-bold">{numberFormat.format(summary.total)}</text>
        <text x="80" y="98" textAnchor="middle" className="fill-[#52514e] text-[11px]">รายการ</text>
      </svg>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {summary.statuses.map((status) => (
          <li key={status.value} className={`flex items-center justify-between gap-3 ${status.count === 0 ? "text-[var(--muted)]" : ""}`}>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: status.color }} />
              <span className="truncate">{status.label}</span>
            </span>
            <span className="whitespace-nowrap tabular-nums"><span className="font-semibold text-[var(--foreground)]">{numberFormat.format(status.count)}</span> <span className="text-xs text-[var(--muted)]">({percent(status.share)})</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * แถบเลือกประเภทครุภัณฑ์ด้านบนแดชบอร์ด
 * กดแล้วทั้งหน้ากลายเป็นแดชบอร์ดของประเภทนั้น (KPI, สถานะ, รายอำเภอ ใช้ตัวกรองเดียวกันทั้งหมด)
 * แสดง 6 ประเภทที่มีจำนวนมากที่สุด ที่เหลืออยู่ในรายการ "ประเภทอื่น"
 */
export function CategoryChips({ summary, basePath, visible = 6 }: { summary: DashboardSummary; basePath: string; visible?: number }) {
  const picker = summary.categories;
  if (picker.length === 0) return null;

  const selected = summary.filters.category;
  const selectedIndex = picker.findIndex((item) => item.key === selected);
  // ประเภทที่เลือกอยู่ต้องเห็นเสมอ แม้จะอยู่นอก 6 อันดับแรก
  const shown = selectedIndex >= visible ? [...picker.slice(0, visible - 1), picker[selectedIndex]] : picker.slice(0, visible);
  const rest = picker.filter((item) => !shown.includes(item));

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition ${
      active
        ? "border-transparent bg-[var(--primary)] text-white"
        : "border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-[var(--primary-soft)]"
    }`;

  return (
    <nav aria-label="เลือกประเภทครุภัณฑ์" className="flex flex-wrap items-center gap-2">
      <Link href={hrefWith(basePath, summary.filters, { category: "" })} className={chip(!selected)} aria-current={!selected ? "page" : undefined}>
        ทุกประเภท
      </Link>
      {shown.map((item) => (
        <Link
          key={item.key}
          href={hrefWith(basePath, summary.filters, { category: item.key })}
          className={chip(item.key === selected)}
          aria-current={item.key === selected ? "page" : undefined}
        >
          {item.label.replace(/^\d+\.\s*/, "")}
          <span className={item.key === selected ? "text-white/80" : "text-[var(--muted)]"}>{numberFormat.format(item.count)}</span>
        </Link>
      ))}
      {rest.length > 0 && (
        <details className="relative">
          <summary className={`${chip(false)} cursor-pointer list-none`}>+ ประเภทอื่น ({rest.length})</summary>
          <div className="absolute right-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-lg">
            {rest.map((item) => (
              <Link
                key={item.key}
                href={hrefWith(basePath, summary.filters, { category: item.key })}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs hover:bg-[var(--primary-soft)]"
              >
                <span className="min-w-0 truncate">{item.label.replace(/^\d+\.\s*/, "")}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">{numberFormat.format(item.count)}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </nav>
  );
}

/** สีตามสถานะ ใช้ชุดเดียวกับโดนัทสถานะ เพื่อให้อ่านข้ามกราฟได้ */
const STATUS_COLOR = new Map(DASHBOARD_STATUSES.map((status) => [status.value, status.color]));

export function CategoryBars({ summary, basePath }: { summary: DashboardSummary; basePath: string }) {
  const rows = summary.categories.slice(0, 10);
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="py-10 text-center text-sm text-[var(--muted)]">ไม่มีครุภัณฑ์ตามตัวกรอง</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const selected = row.key === summary.filters.category;
        // แต่ละแถบแบ่งเป็นช่วงตามสถานะ ความยาวรวมเทียบกับประเภทที่มากที่สุด
        const widthOfRow = Math.max((row.count / max) * 100, 1);
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--foreground)]">{row.label}</span>
              <span className="whitespace-nowrap tabular-nums">
                <span className="font-semibold">{numberFormat.format(row.count)}</span>{" "}
                <span className="text-xs text-[var(--muted)]">{percent(row.share)} · พร้อมใช้ {percent(row.activeRate)}</span>
              </span>
            </span>
            <span className="mt-1.5 block h-3 rounded-r-[4px]" style={{ background: TRACK }}>
              <span className="flex h-3 overflow-hidden rounded-r-[4px]" style={{ width: `${widthOfRow}%` }}>
                {DASHBOARD_STATUSES.map((status) => {
                  const count = row.statuses[status.value];
                  if (!count) return null;
                  return (
                    <span
                      key={status.value}
                      style={{ width: `${(count / row.count) * 100}%`, background: selected || !summary.filters.category ? STATUS_COLOR.get(status.value) : BAR_MUTED }}
                    />
                  );
                })}
              </span>
            </span>
            <Tip>
              {row.label}
              <br />
              {numberFormat.format(row.count)} รายการ · {percent(row.share)}
              <br />
              {DASHBOARD_STATUSES.filter((status) => row.statuses[status.value] > 0)
                .map((status) => `${status.label} ${numberFormat.format(row.statuses[status.value])}`)
                .join(" · ")}
              <br />
              ราคาทุนรวม {baht(row.cost)} บาท
            </Tip>
          </>
        );
        return (
          <li key={row.key} className="group relative">
            {!selected ? (
              <Link href={hrefWith(basePath, summary.filters, { category: row.key })} className="block rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]">
                {content}
              </Link>
            ) : (
              <div tabIndex={0} className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DistrictColumns({ summary, basePath }: { summary: DashboardSummary; basePath: string }) {
  // Sorted by count so the magnitude comparison reads left to right; the table below keeps name order.
  const rows = [...summary.districts].sort((a, b) => b.total - a.total || a.district.localeCompare(b.district, "th"));
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (!rows.length) return <p className="py-10 text-center text-sm text-[var(--muted)]">ไม่มีข้อมูลอำเภอ</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-end gap-3 border-b border-[#c3c2b7] px-1 pt-6 sm:min-w-0" role="img" aria-label={`จำนวนครุภัณฑ์ตามอำเภอ: ${rows.map((r) => `${r.district} ${r.total}`).join(", ")}`}>
        {rows.map((row) => {
          const height = Math.round((row.total / max) * 180);
          return (
            <Link key={row.district} href={hrefWith(basePath, summary.filters, { district: row.district, facility: "" })}
              className="group relative flex min-w-14 flex-1 flex-col items-center justify-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]" style={{ height: 212 }}>
              <span className="mb-1 text-xs font-semibold tabular-nums text-[var(--foreground)]">{numberFormat.format(row.total)}</span>
              <span className="block w-full max-w-12 rounded-t-[4px] transition group-hover:opacity-80" style={{ height: Math.max(height, row.total ? 2 : 0), background: !summary.filters.district || row.district === summary.filters.district ? BAR : BAR_MUTED }} />
              <Tip>อ.{row.district}<br />{numberFormat.format(row.total)} รายการ · {row.facilities} หน่วยงาน<br />ราคาทุนรวม {baht(row.cost)} บาท</Tip>
            </Link>
          );
        })}
      </div>
      <div className="flex min-w-max gap-3 px-1 pt-2 sm:min-w-0">
        {rows.map((row) => <span key={row.district} className="min-w-14 flex-1 truncate text-center text-xs text-[var(--muted)]" title={row.district}>{row.district}</span>)}
      </div>
    </div>
  );
}

