"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";

export type ExpiringMaintenanceRow = {
  id: number;
  assetName: string;
  assetRegistrationNo: string;
  assetGroup: "Hardware" | "Software";
  currentStatus: string;
  daysRemaining: number;
  deviceType: string;
  districtName: string;
  facilityName: string;
  locationDetail: string;
  maintenanceEndDate: string;
  manufacturerBrand: string;
  operatingSystem: string;
  ownerName?: string;
  privateIp: string;
  publicIp?: string;
  serialNumber?: string;
  updatedAt: string;
  updatedBy: string;
  usageDescription: string;
};

type ExpiringMaintenanceTableProps = {
  rows: ExpiringMaintenanceRow[];
  criticalCount: number;
  warningCount: number;
  canViewAdminFields: boolean;
  canViewPublicIp: boolean;
};

function urgencyTone(days: number): "danger" | "warning" | "neutral" {
  if (days <= 7) return "danger";
  if (days <= 20) return "warning";
  return "neutral";
}

function DetailField({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="min-w-0 border-b border-black/6 py-3 last:border-b-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--foreground)]">{value || "-"}</dd>
    </div>
  );
}

export function ExpiringMaintenanceTable({
  rows,
  criticalCount,
  warningCount,
  canViewAdminFields,
  canViewPublicIp,
}: ExpiringMaintenanceTableProps) {
  const [selectedRow, setSelectedRow] = useState<ExpiringMaintenanceRow | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!selectedRow) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedRow(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedRow]);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Maintenance Alert</p>
          <h2 className="section-title mt-1 text-xl font-semibold">สัญญาบำรุงรักษาใกล้หมดอายุ</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">แสดงรายการที่หมดอายุภายใน 45 วันนับจากวันนี้</p>
        </div>
        {rows.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-2 text-xs">
            <StatusBadge tone="danger" className="gap-1.5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              วิกฤต ≤ 7 วัน: {criticalCount} รายการ
            </StatusBadge>
            <StatusBadge tone="warning" className="gap-1.5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              เฝ้าระวัง: {warningCount} รายการ
            </StatusBadge>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-emerald-700">ไม่มีสัญญาบำรุงรักษาที่ใกล้หมดอายุ</p>
          <p className="mt-1 text-xs text-emerald-600">ทุกรายการมีสัญญาที่ยังมีผลบังคับใช้นานกว่า 45 วัน</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-black/8 bg-white/85">
          <div className="flex flex-col gap-2 border-b border-black/6 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[var(--foreground)]">{rows.length} รายการ เรียงตามวันที่เหลือน้อยที่สุด</p>
            <p className="text-xs text-[var(--muted)]">กด “รายละเอียด” เพื่อดูข้อมูลเพิ่มเติมของแต่ละรายการ</p>
          </div>

          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-[920px] w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-black/8 bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="w-28 px-4 py-3 font-medium">คงเหลือ</th>
                  <th className="px-4 py-3 font-medium">ทรัพย์สิน</th>
                  <th className="px-4 py-3 font-medium">หน่วยงาน</th>
                  <th className="px-4 py-3 font-medium">ประเภท</th>
                  <th className="px-4 py-3 font-medium">วันหมดอายุ</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="w-32 px-4 py-3 text-right font-medium">เพิ่มเติม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top transition hover:bg-[var(--primary-soft)]/40">
                    <td className="px-4 py-3">
                      <StatusBadge tone={urgencyTone(row.daysRemaining)} className="font-mono">
                        {row.daysRemaining} วัน
                      </StatusBadge>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-semibold text-[var(--foreground)]">{row.assetName}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo || "-"}</p>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-medium text-[var(--foreground)]">{row.facilityName}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{row.districtName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">{row.deviceType}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{row.assetGroup}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground)]">{formatThaiDate(row.maintenanceEndDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={assetStatusTone(row.currentStatus)}>{assetStatusLabel(row.currentStatus)}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(row)}
                        className="min-h-10 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        รายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedRow &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="ปิดรายละเอียดสัญญาบำรุงรักษา"
              className="absolute inset-0 bg-black/40"
              onClick={() => setSelectedRow(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl sm:p-7"
            >
              <div className="flex items-start justify-between gap-4 border-b border-black/8 pb-4">
                <div className="min-w-0">
                  <StatusBadge tone={urgencyTone(selectedRow.daysRemaining)} className="font-mono">
                    เหลือ {selectedRow.daysRemaining} วัน
                  </StatusBadge>
                  <h3 id={titleId} className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                    {selectedRow.assetName}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {selectedRow.facilityName} · {selectedRow.districtName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  aria-label="ปิดหน้าต่างรายละเอียด"
                  className="min-h-11 min-w-11 shrink-0 rounded-xl text-[var(--muted)] transition hover:bg-stone-100 hover:text-[var(--foreground)]"
                >
                  ✕
                </button>
              </div>

              <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
                <DetailField label="เลขทะเบียนทรัพย์สิน" value={selectedRow.assetRegistrationNo} />
                <DetailField label="วันสิ้นสุดสัญญา MA" value={formatThaiDate(selectedRow.maintenanceEndDate)} />
                <DetailField label="ประเภททรัพย์สิน / อุปกรณ์" value={`${selectedRow.deviceType} · ${selectedRow.assetGroup}`} />
                <DetailField label="สถานะปัจจุบัน" value={assetStatusLabel(selectedRow.currentStatus)} />
                <DetailField label="ยี่ห้อ / รุ่น" value={selectedRow.manufacturerBrand} />
                <DetailField label="ระบบปฏิบัติการ" value={selectedRow.operatingSystem} />
                <DetailField label="สถานที่ติดตั้ง" value={selectedRow.locationDetail} />
                <DetailField label="Private IP" value={selectedRow.privateIp} />
                {canViewPublicIp && <DetailField label="Public IP" value={selectedRow.publicIp} />}
                {canViewAdminFields && <DetailField label="Serial Number" value={selectedRow.serialNumber} />}
                {canViewAdminFields && <DetailField label="ผู้ดูแล" value={selectedRow.ownerName} />}
                <DetailField label="ปรับปรุงล่าสุด" value={`${selectedRow.updatedBy} · ${formatThaiDateTime(selectedRow.updatedAt)}`} />
              </dl>

              <div className="mt-5 rounded-xl border border-black/8 bg-[var(--neutral-bg)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">รายละเอียดการใช้งาน</p>
                <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{selectedRow.usageDescription || "-"}</p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
