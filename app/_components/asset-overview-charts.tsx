import Link from "next/link";

import type { DashboardSummary } from "@/lib/dashboard-summary";
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

export function CategoryBars({ summary, basePath }: { summary: DashboardSummary; basePath: string }) {
  const top = summary.categories.slice(0, 8);
  const rest = summary.categories.slice(8);
  const rows = rest.length
    ? [...top, { key: "", label: `อื่น ๆ (${rest.length} ประเภท)`, count: rest.reduce((s, r) => s + r.count, 0), cost: rest.reduce((s, r) => s + r.cost, 0), share: rest.reduce((s, r) => s + r.share, 0) }]
    : top;
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="py-10 text-center text-sm text-[var(--muted)]">ไม่มีครุภัณฑ์ตามตัวกรอง</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--foreground)]">{row.label}</span>
              <span className="whitespace-nowrap tabular-nums"><span className="font-semibold">{numberFormat.format(row.count)}</span> <span className="text-xs text-[var(--muted)]">{percent(row.share)}</span></span>
            </span>
            <span className="mt-1.5 block h-3 rounded-r-[4px] bg-[var(--line)]/40">
              <span className="block h-3 rounded-r-[4px]" style={{ width: `${Math.max((row.count / max) * 100, 1)}%`, background: row.key ? BAR : BAR_MUTED }} />
            </span>
            <Tip>{row.label}<br />{numberFormat.format(row.count)} รายการ · {percent(row.share)}<br />ราคาทุนรวม {baht(row.cost)} บาท</Tip>
          </>
        );
        return (
          <li key={row.key || "other"} className="group relative">
            {row.key && row.key !== summary.filters.category
              ? <Link href={hrefWith(basePath, summary.filters, { category: row.key })} className="block rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]">{content}</Link>
              : <div tabIndex={0} className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]">{content}</div>}
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

