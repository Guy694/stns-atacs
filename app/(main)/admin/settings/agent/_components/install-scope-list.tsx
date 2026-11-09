"use client";

import { useTransition } from "react";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { AppIcon } from "@/app/_components/ui/icon";
import { confirmAction } from "@/app/_components/ui/confirm";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { toast } from "@/app/_components/ui/toast";
import { useTableState } from "@/app/_components/ui/use-table-state";
import { revokeAgentEnrollmentAction, revokeInstallCommand } from "@/app/(main)/admin/settings/agent/actions";
import { formatThaiDateTime } from "@/lib/date-format";

import { formatRelativeThai } from "./relative-time";

export type InstallScopeRow = {
  key: string;
  facilityId: number;
  facilityName: string;
  workGroupId: number | null;
  workGroupName: string | null;
  deviceCount: number;
  lastUsedAt: string | null;
  createdAt: string;
};

export type LegacyEnrollmentRow = {
  id: number;
  facilityName: string;
  enrollmentName: string;
  workGroupName: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

const th = "px-4 py-2.5 font-medium whitespace-nowrap";

export function InstallScopeList({ scopes, legacy, nowMs }: { scopes: InstallScopeRow[]; legacy: LegacyEnrollmentRow[]; nowMs: number }) {
  const [pending, startTransition] = useTransition();
  const table = useTableState(scopes, {
    facility: (row) => row.facilityName,
    devices: (row) => row.deviceCount,
    lastUsed: (row) => row.lastUsedAt ?? "",
    created: (row) => row.createdAt,
  }, { initialSort: { key: "facility", dir: "asc" }, pageSize: 10 });

  async function revokeScope(row: InstallScopeRow) {
    const label = row.workGroupName ? `${row.facilityName} · ${row.workGroupName}` : row.facilityName;
    const ok = await confirmAction({
      title: `ยกเลิกรหัสติดตั้งของ ${label} ?`,
      text: "คำสั่งติดตั้งที่คัดลอกไปแล้วจะลงทะเบียนเครื่องใหม่ไม่ได้อีก เครื่องที่ติดตั้งแล้วยังรายงานได้ตามปกติ เมื่อคัดลอกคำสั่งครั้งถัดไประบบจะออกรหัสใหม่ให้เอง",
      confirmText: "ยกเลิกรหัสติดตั้ง",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await revokeInstallCommand({ facilityId: row.facilityId, workGroupId: row.workGroupId });
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch {
        toast.error("ยกเลิกรหัสติดตั้งไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  async function revokeLegacy(row: LegacyEnrollmentRow) {
    const ok = await confirmAction({
      title: `ปิดรหัสแบบเดิม “${row.enrollmentName}” ?`,
      text: "เครื่องที่ยังไม่ได้ลงทะเบียนจะใช้รหัสนี้ไม่ได้อีก เครื่องที่ติดตั้งแล้วยังทำงานตามปกติ",
      confirmText: "ปิดรหัส",
      danger: true,
    });
    if (!ok) return;
    const formData = new FormData();
    formData.set("enrollmentId", String(row.id));
    startTransition(async () => {
      try {
        await revokeAgentEnrollmentAction(formData);
        toast.success("ปิดรหัสแบบเดิมแล้ว");
      } catch {
        toast.error("ปิดรหัสไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  return (
    <div className="min-w-0">
      {scopes.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
          ยังไม่มีหน่วยงานที่เปิดให้ติดตั้ง — เมื่อคัดลอกคำสั่งติดตั้งครั้งแรก หน่วยงานนั้นจะแสดงที่นี่
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--primary-soft)]/40 text-xs text-[var(--muted)]">
                  <SortableTh label="หน่วยงาน / กลุ่มงาน" sortKey="facility" sort={table.sort} onSort={table.onSort} className={th} />
                  <SortableTh label="เครื่องที่ลงทะเบียน" sortKey="devices" sort={table.sort} onSort={table.onSort} align="right" className={th} />
                  <SortableTh label="ใช้ล่าสุด" sortKey="lastUsed" sort={table.sort} onSort={table.onSort} className={th} />
                  <SortableTh label="เปิดเมื่อ" sortKey="created" sort={table.sort} onSort={table.onSort} className={th} />
                  <th className={`${th} w-16 text-right`}><span className="sr-only">การจัดการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {table.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2">
                      <p className="font-medium">{row.facilityName}</p>
                      {row.workGroupName ? <p className="text-xs text-[var(--muted)]">{row.workGroupName}</p> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.deviceCount.toLocaleString("th-TH")}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--muted)]" title={row.lastUsedAt ? formatThaiDateTime(row.lastUsedAt) : undefined}>
                      {row.lastUsedAt ? formatRelativeThai(row.lastUsedAt, nowMs) : "ยังไม่ถูกใช้"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--muted)]">{formatThaiDateTime(row.createdAt)}</td>
                    <td className="px-4 py-1.5 text-right">
                      <ActionIconButton icon="power-off" tone="danger" label="ยกเลิกรหัสติดตั้ง" disabled={pending} onClick={() => revokeScope(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination {...table} onPage={table.onPage} label="แบ่งหน้ารายการหน่วยงานที่เปิดให้ติดตั้ง" className="border-t border-[var(--line)]" />
        </>
      )}

      {legacy.length > 0 ? (
        <details className="group border-t border-[var(--line)]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-[var(--accent-strong)] hover:bg-[var(--primary-soft)]/50">
            <AppIcon name="chevron-right" size={16} aria-hidden="true" className="transition group-open:rotate-90" />
            รหัสแบบเดิม ({legacy.length.toLocaleString("th-TH")} รายการที่ยังเปิดอยู่)
          </summary>
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] text-xs text-[var(--muted)]">
                  <th className={`${th} text-left`}>หน่วยงาน</th>
                  <th className={`${th} text-left`}>ชื่อกำกับ</th>
                  <th className={`${th} text-left`}>หมดอายุ</th>
                  <th className={`${th} text-left`}>ใช้ล่าสุด</th>
                  <th className={`${th} w-16 text-right`}><span className="sr-only">การจัดการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {legacy.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-medium">{row.facilityName}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">{row.enrollmentName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--muted)]">{row.expiresAt ? formatThaiDateTime(row.expiresAt) : "ไม่หมดอายุ"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--muted)]">{row.lastUsedAt ? formatRelativeThai(row.lastUsedAt, nowMs) : "-"}</td>
                    <td className="px-4 py-1.5 text-right">
                      <ActionIconButton icon="power-off" tone="danger" label="ปิดรหัสแบบเดิม" disabled={pending} onClick={() => revokeLegacy(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
