import Link from "next/link";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import type { DisposalRequest } from "@/lib/asset-disposals";
import type { Repair } from "@/lib/asset-repairs";
import type { AssetTransfer } from "@/lib/asset-transfers";
import { VALUATION_STATUS_LABELS, type ScheduleRow, type Valuation } from "@/lib/asset-valuation";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";
import { DISPOSAL_REQUEST_TYPE_LABELS, DISPOSAL_STATUS_LABELS, DISPOSAL_STATUS_TONES, disposalMethodLabel } from "@/lib/disposal-options";
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_TONES } from "@/lib/repair-options";
import type { AuditLog } from "@/lib/audit";
import type { AssetStatusHistory } from "@/lib/asset-status-history";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";

const baht = (value: number | null | undefined) => (value === null || value === undefined ? "-" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const heading = "text-sm font-semibold text-[var(--muted)]";
/** In the history tabs the tab already names the list: drop the panel chrome, keep the heading for screen readers and #anchors. */
const panel = (bare: boolean | undefined, extra = "") => (bare ? "" : `glass-panel rounded-2xl ${extra}`.trim());
const headingClass = (bare: boolean | undefined) => (bare ? "sr-only" : heading);
const MIGRATION_NOTE = "ยังไม่ได้เปิดใช้ (ต้องรัน database/add_asset_lifecycle.sql)";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
      {hint && <p className="text-[11px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function ValuationSection({ valuation, schedule, currentFiscalYear, asOf }: { valuation: Valuation; schedule: ScheduleRow[]; currentFiscalYear: number; asOf: string }) {
  const life = valuation.life;
  return (
    <section className="glass-panel rounded-2xl p-5" aria-labelledby="valuation-heading">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="valuation-heading" className={`${heading} scroll-mt-20`}>มูลค่าและค่าเสื่อมราคา</h2>
        <span className="text-xs text-[var(--muted)]">ประมาณการแบบเส้นตรง ราคาซาก 1 บาท · ข้อมูล ณ {formatThaiDate(asOf)}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="ราคาทุน (บาท)" value={baht(valuation.cost)} />
        <Stat label="ค่าเสื่อมสะสม (บาท)" value={valuation.status === "ok" ? baht(valuation.accumulated) : "-"} />
        <Stat label="มูลค่าสุทธิ (บาท)" value={baht(valuation.bookValue)} hint={valuation.isFullyDepreciated ? `ครบอายุเมื่อ ${formatThaiDate(valuation.fullyDepreciatedOn)}` : undefined} />
        <Stat
          label="อายุการใช้งาน"
          value={life.years ? `${life.years} ปี${life.annualRate ? ` (${life.annualRate}%/ปี)` : ""}` : "-"}
          hint={life.source === "override" ? "กำหนดเฉพาะรายการ" : life.rateLabel || life.categoryLabel}
        />
      </div>
      {valuation.status !== "ok" && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{VALUATION_STATUS_LABELS[valuation.status]}</p>
      )}
      {schedule.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--primary)]">ตารางค่าเสื่อมราคารายปีงบประมาณ ({schedule.length} ปี)</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">ปีงบประมาณ</th>
                  <th className="px-3 py-2 text-right font-medium">ค่าเสื่อมประจำปี</th>
                  <th className="px-3 py-2 text-right font-medium">ค่าเสื่อมสะสม</th>
                  <th className="px-3 py-2 text-right font-medium">มูลค่าสุทธิสิ้นปี</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {schedule.map((row) => (
                  <tr key={row.fiscalYear} className={row.fiscalYear === currentFiscalYear ? "bg-[var(--primary-soft)]/40 font-medium" : undefined}>
                    <td className="px-3 py-2">{row.fiscalYear}{row.fiscalYear === currentFiscalYear ? " (ปีปัจจุบัน)" : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{baht(row.depreciation)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{baht(row.accumulated)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{baht(row.bookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export function TransferHistorySection({ rows, schemaReady, bare }: { rows: AssetTransfer[]; schemaReady: boolean; bare?: boolean }) {
  return (
    <section className={`${panel(bare)} overflow-hidden`} aria-labelledby="transfer-history-heading">
      <div className={bare ? "" : "border-b border-black/8 px-5 py-4"}>
        <h2 id="transfer-history-heading" className={headingClass(bare)}>ประวัติการโอนย้าย</h2>
      </div>
      {!schemaReady ? <p className="px-5 py-6 text-sm text-amber-700">{MIGRATION_NOTE}</p> : rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-[var(--muted)]">ยังไม่เคยโอนย้าย</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 w-14 text-right font-medium">ลำดับ</th>
                <th className="px-4 py-2.5 text-left font-medium">วันที่</th>
                <th className="px-4 py-2.5 text-left font-medium">จาก</th>
                <th className="px-4 py-2.5 text-left font-medium">ไป</th>
                <th className="px-4 py-2.5 text-left font-medium">เหตุผล / เอกสาร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--muted)]">{(rowIndex + 1).toLocaleString("th-TH")}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs">{formatThaiDate(row.transferDate)}<p className="text-[var(--muted)]">{row.transferredBy}</p></td>
                  <td className="px-4 py-2.5 text-xs">{row.fromFacilityName}{row.fromWorkGroupName && <p className="text-[var(--muted)]">{row.fromWorkGroupName}</p>}<p className="text-[var(--muted)]">{[row.fromOwnerName, row.fromLocationDetail].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-4 py-2.5 text-xs">{row.toFacilityName}{row.toWorkGroupName && <p className="text-[var(--muted)]">{row.toWorkGroupName}</p>}<p className="text-[var(--muted)]">{[row.toOwnerName, row.toLocationDetail].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.reason || "-"}{row.documentNo && <p>เอกสาร: {row.documentNo}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RepairHistorySection({ rows, schemaReady, bare }: { rows: Repair[]; schemaReady: boolean; bare?: boolean }) {
  const totalCost = rows.filter((row) => row.status !== "Cancelled").reduce((sum, row) => sum + (row.cost ?? 0), 0);
  return (
    <section className={`${panel(bare)} overflow-hidden`} aria-labelledby="repair-history-heading">
      <div className={`flex flex-wrap items-baseline justify-between gap-2 px-5 ${bare ? (rows.length > 0 ? "pt-3" : "") : "border-b border-black/8 py-4"}`}>
        <h2 id="repair-history-heading" className={headingClass(bare)}>ประวัติการซ่อม</h2>
        {rows.length > 0 && <span className="text-xs text-[var(--muted)]">{rows.length} ครั้ง · ค่าใช้จ่ายรวม {baht(totalCost)} บาท</span>}
      </div>
      {!schemaReady ? <p className="px-5 py-6 text-sm text-amber-700">{MIGRATION_NOTE}</p> : rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีประวัติการซ่อม</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/repairs/${row.id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">#{row.id}</Link>
                <span className="ml-2 text-xs text-[var(--muted)]">{formatThaiDate(row.reportedAt)}</span>
                <p className="mt-0.5 line-clamp-2">{row.problem}</p>
                {row.resolution && <p className="text-xs text-[var(--muted)]">ผล: {row.resolution}</p>}
              </div>
              <div className="text-right">
                <StatusBadge tone={REPAIR_STATUS_TONES[row.status]}>{REPAIR_STATUS_LABELS[row.status]}</StatusBadge>
                {row.cost !== null && <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">{baht(row.cost)} บาท</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DisposalHistorySection({ rows }: { rows: DisposalRequest[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="glass-panel overflow-hidden rounded-2xl" aria-labelledby="disposal-history-heading">
      <div className="border-b border-black/8 px-5 py-4"><h2 id="disposal-history-heading" className={heading}>คำขอจำหน่าย / สูญหาย</h2></div>
      <ul className="divide-y divide-black/5">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <Link href={`/disposal?requestId=${row.id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">#{row.id}</Link>
              <span className="ml-2">{DISPOSAL_REQUEST_TYPE_LABELS[row.requestType]}{row.disposalMethod ? ` · ${disposalMethodLabel(row.disposalMethod)}` : ""}</span>
              <p className="text-xs text-[var(--muted)]">เสนอ {formatThaiDate(row.requestedAt)} โดย {row.requestedBy}{row.decidedBy ? ` · พิจารณาโดย ${row.decidedBy}` : ""}</p>
            </div>
            <StatusBadge tone={DISPOSAL_STATUS_TONES[row.status]}>{DISPOSAL_STATUS_LABELS[row.status]}</StatusBadge>
          </li>
        ))}
      </ul>
    </section>
  );
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  transfer: "โอนย้าย",
  dispose: "จำหน่าย/ชำรุด",
  inspect: "ตรวจนับ",
};

const AUDIT_ACTION_TONE: Record<string, "success" | "info" | "danger" | "warning" | "neutral"> = {
  create: "success",
  update: "info",
  delete: "danger",
  transfer: "warning",
  dispose: "warning",
  inspect: "neutral",
};

/**
 * ประวัติการเปลี่ยนแปลงของครุภัณฑ์ชิ้นนี้ (จาก audit_logs)
 * ผู้ตรวจสอบมักขอดูว่าใครแก้อะไรเมื่อไร จึงแสดงไว้ในหน้ารายละเอียดโดยตรง
 */
export function AuditHistorySection({ rows, schemaReady = true, bare }: { rows: AuditLog[]; schemaReady?: boolean; bare?: boolean }) {
  return (
    <section className={bare ? "p-5" : "glass-panel rounded-2xl p-5"} aria-labelledby="audit-history-heading">
      <div className={`flex flex-wrap items-baseline justify-between gap-2 ${rows.length > 0 || !bare ? "mb-4" : ""}`}>
        <h2 id="audit-history-heading" className={headingClass(bare)}>ประวัติการแก้ไขข้อมูล</h2>
        <span className="text-xs text-[var(--muted)]">{rows.length > 0 ? `${rows.length} รายการล่าสุด` : ""}</span>
      </div>
      {!schemaReady ? (
        <p className="text-sm text-[var(--muted)]">ยังไม่ได้เปิดใช้ (ต้องมีตาราง audit_logs)</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">ยังไม่มีการแก้ไขที่บันทึกไว้สำหรับครุภัณฑ์นี้</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
              <StatusBadge tone={AUDIT_ACTION_TONE[row.action] ?? "neutral"}>
                {AUDIT_ACTION_LABEL[row.action] ?? row.action}
              </StatusBadge>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{row.summary || "-"}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {row.userName || "ไม่ทราบผู้ใช้"} · {formatThaiDateTime(row.createdAt, row.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** ประวัติการเปลี่ยนสถานะอุปกรณ์ (ย้ายมาจาก page.tsx เพื่อใช้ในแท็บประวัติ) */
export function StatusHistorySection({ rows, bare }: { rows: AssetStatusHistory[]; bare?: boolean }) {
  return (
    <section className={`${panel(bare)} overflow-hidden`} aria-labelledby="status-history-heading">
      <div className={bare ? "px-5 pt-3" : "border-b border-black/8 px-5 py-4"}>
        <h2 id="status-history-heading" className={headingClass(bare)}>ประวัติสถานะอุปกรณ์</h2>
        <p className={`${bare ? "" : "mt-1 "}text-xs text-[var(--muted)]`}>แสดงการอัปเดตข้อมูลของอุปกรณ์นี้จากการแก้ไข โอนย้าย หรือบันทึกจำหน่าย/ชำรุด</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
          ยังไม่มีประวัติการอัปเดตสถานะสำหรับอุปกรณ์นี้
        </div>
      ) : (
        <div className={`overflow-x-auto ${bare ? "mt-3 border-t border-black/8" : ""}`}>
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-black/8 bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 w-14 text-right font-medium">ลำดับ</th>
                <th className="px-4 py-3 font-medium">วันที่/เวลา</th>
                <th className="px-4 py-3 font-medium">สถานะเดิม</th>
                <th className="px-4 py-3 font-medium">สถานะใหม่</th>
                <th className="px-4 py-3 font-medium">ผู้บันทึก</th>
                <th className="px-4 py-3 font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6 bg-white/70">
              {rows.map((entry, rowIndex) => (
                <tr key={entry.id} className="align-top hover:bg-[var(--primary-soft)]/30">
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{(rowIndex + 1).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatThaiDateTime(entry.changedAt)}</td>
                  <td className="px-4 py-3">
                    {entry.fromStatus ? (
                      <StatusBadge tone={assetStatusTone(entry.fromStatus)}>{assetStatusLabel(entry.fromStatus)}</StatusBadge>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">เริ่มต้น</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={assetStatusTone(entry.toStatus)}>{assetStatusLabel(entry.toStatus)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{entry.changedBy || "system"}</td>
                  <td className="max-w-md px-4 py-3 text-xs leading-5 text-[var(--muted)]">{entry.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
