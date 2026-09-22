"use client";

import Link from "next/link";
import { Fragment, useState } from "react";

import { baht, hrefWith, numberFormat, percent, Tip } from "@/app/_components/overview-format";
import type { DashboardSummary } from "@/lib/dashboard-summary";

type Summary = DashboardSummary;
type StatusCounts = Summary["districts"][number]["statuses"];

function StatusBar({ label, total, counts, statuses }: { label: string; total: number; counts: StatusCounts; statuses: Summary["statuses"] }) {
  if (total === 0) return <span className="text-xs text-[var(--muted)]">ไม่มีรายการ</span>;
  const segments = statuses.map((status) => ({ ...status, count: counts[status.value] })).filter((s) => s.count > 0);
  return (
    <div className="flex h-3 gap-[2px]" role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}>
      {segments.map((s, index) => (
        <span key={s.value} tabIndex={0} className={`group relative block h-3 ${index === segments.length - 1 ? "rounded-r-[4px]" : ""}`} style={{ width: `${(s.count / total) * 100}%`, background: s.color, minWidth: 3 }}>
          <Tip>{label} · {s.label}<br />{numberFormat.format(s.count)} รายการ ({percent(s.count / total)})</Tip>
        </span>
      ))}
    </div>
  );
}

/** District comparison; each district row expands to its facilities (same columns, same filters). */
export function DistrictComparison({ summary, basePath }: { summary: Summary; basePath: string }) {
  const rows = summary.districts;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(summary.filters.district ? [summary.filters.district] : []));
  const allExpanded = rows.length > 0 && rows.every((row) => expanded.has(row.district));
  const toggle = (district: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(district)) next.delete(district); else next.add(district);
    return next;
  });
  const totals = rows.reduce((acc, row) => ({ facilities: acc.facilities + row.facilities, total: acc.total + row.total, active: acc.active + row.statuses.Active, cost: acc.cost + row.cost }), { facilities: 0, total: 0, active: 0, cost: 0 });

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="คำอธิบายสี">
          {summary.statuses.map((status) => <li key={status.value} className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: status.color }} />{status.label}</li>)}
        </ul>
        {rows.length > 0 && (
          <button type="button" onClick={() => setExpanded(allExpanded ? new Set() : new Set(rows.map((row) => row.district)))}
            className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-medium text-[var(--primary-text)] transition hover:bg-[var(--primary-soft)]">
            {allExpanded ? "ย่อทั้งหมด" : "แสดงหน่วยงานทุกอำเภอ"}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
            <tr>
              <th scope="col" className="py-2 pr-3 text-left font-medium">อำเภอ / หน่วยงาน</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">หน่วยงาน</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">ครุภัณฑ์</th>
              <th scope="col" className="w-[32%] px-3 py-2 text-left font-medium">สถานะการใช้งาน</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">พร้อมใช้งาน</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">มูลค่ารวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = expanded.has(row.district);
              const selected = row.district === summary.filters.district;
              const panelId = `district-${row.district}`;
              return (
                <Fragment key={row.district}>
                  <tr className={`border-t border-[var(--line)] ${selected ? "bg-[var(--primary-soft)]/60" : ""}`}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                      <button type="button" onClick={() => toggle(row.district)} aria-expanded={open} aria-controls={panelId} disabled={row.facilityRows.length === 0}
                        className="-ml-1 inline-flex min-h-9 items-center gap-2 rounded px-1 text-left hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:cursor-default disabled:hover:text-inherit">
                        <svg aria-hidden viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-90" : ""}`}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        อ.{row.district}
                      </button>
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums">{numberFormat.format(row.facilities)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{numberFormat.format(row.total)}</td>
                    <td className="px-3 py-2.5"><StatusBar label={`อ.${row.district}`} total={row.total} counts={row.statuses} statuses={summary.statuses} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.total ? percent(row.statuses.Active / row.total) : "-"}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">{baht(row.cost)}</td>
                  </tr>
                  {open && row.facilityRows.map((facility, index) => (
                    <tr key={facility.id} id={index === 0 ? panelId : undefined}
                      className={`text-[13px] ${String(facility.id) === summary.filters.facility ? "bg-[var(--primary-soft)]/60" : "bg-[#f8fafc]"}`}>
                      <td className="py-2 pl-7 pr-3">
                        <Link href={hrefWith(basePath, summary.filters, { district: row.district, facility: String(facility.id) })} className="text-[var(--foreground)] hover:text-[var(--primary-text)] hover:underline">
                          {facility.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--muted)]">–</td>
                      <td className="px-3 py-2 text-right tabular-nums">{numberFormat.format(facility.total)}</td>
                      <td className="px-3 py-2"><StatusBar label={facility.name} total={facility.total} counts={facility.statuses} statuses={summary.statuses} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{facility.total ? percent(facility.statuses.Active / facility.total) : "-"}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{baht(facility.cost)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot className="border-t border-[#c3c2b7] font-semibold">
              <tr>
                <th scope="row" className="py-2.5 pr-3 text-left">รวม</th>
                <td className="px-3 py-2.5 text-right tabular-nums">{numberFormat.format(totals.facilities)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{numberFormat.format(totals.total)}</td>
                <td />
                <td className="px-3 py-2.5 text-right tabular-nums">{totals.total ? percent(totals.active / totals.total) : "-"}</td>
                <td className="py-2.5 pl-3 text-right tabular-nums">{baht(totals.cost)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
