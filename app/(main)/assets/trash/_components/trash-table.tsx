"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreAssetAction } from "@/app/(main)/assets/actions";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { confirmAction, showError } from "@/app/_components/ui/confirm";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { toast } from "@/app/_components/ui/toast";
import { useTableState } from "@/app/_components/ui/use-table-state";
import type { DeletedAssetRow } from "@/lib/assets";

export type TrashRow = DeletedAssetRow & { deletedAtLabel: string };

const ACCESSORS: Record<string, (row: TrashRow) => unknown> = {
  reg: (row) => row.assetNumber || row.assetRegistrationNo,
  name: (row) => row.assetName,
  facility: (row) => row.facilityName,
  deleted: (row) => row.deletedAt,
  by: (row) => row.deletedBy,
};

export function TrashTable({ rows, canRestore }: { rows: TrashRow[]; canRestore: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const table = useTableState(rows, ACCESSORS, { initialSort: { key: "deleted", dir: "desc" } });

  const th = (key: string, label: string) => (
    <SortableTh key={key} label={label} sortKey={key} sort={table.sort} onSort={table.onSort} className="whitespace-nowrap px-4 py-2.5 font-medium" />
  );

  async function restore(row: TrashRow) {
    const label = `${row.assetNumber ? `${row.assetNumber} ` : ""}${row.assetName}`.trim();
    const confirmed = await confirmAction({
      title: `กู้คืน "${label}" ?`,
      text: "ทรัพย์สินจะกลับไปอยู่ในทะเบียน รายงาน และหน้าหน่วยงานตามเดิม",
      confirmText: "กู้คืน",
    });
    if (!confirmed) return;
    setBusyId(row.id);
    startTransition(async () => {
      const error = await restoreAssetAction(row.id);
      setBusyId(null);
      if (error) {
        await showError(error, "กู้คืนทรัพย์สินไม่สำเร็จ");
        return;
      }
      toast.success(`กู้คืน ${label} แล้ว`);
      router.refresh();
    });
  }

  const restoreButton = (row: TrashRow) =>
    canRestore ? (
      <ActionIconButton
        icon="undo"
        tone="primary"
        label={busyId === row.id ? `กำลังกู้คืน ${row.assetName}…` : `กู้คืน ${row.assetName}`}
        onClick={() => restore(row)}
        disabled={pending}
      />
    ) : (
      <span className="text-xs text-[var(--muted)]">-</span>
    );

  return (
    <>
      {/* Phones: cards, so the restore button never scrolls off-screen */}
      <ul className="divide-y divide-black/6 md:hidden">
        {table.rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{row.assetName || "-"}</p>
              <p className="mt-0.5 break-all font-mono text-xs text-[var(--muted)]">{row.assetNumber || row.assetRegistrationNo || `#${row.id}`}</p>
              <p className="mt-1 text-xs">{row.facilityName}{row.districtName ? ` · อ.${row.districtName}` : ""}</p>
              <p className="text-xs text-[var(--muted)]">ลบเมื่อ {row.deletedAtLabel}{row.deletedBy ? ` · โดย ${row.deletedBy}` : ""}</p>
            </div>
            {restoreButton(row)}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50/60 text-left text-xs text-[var(--muted)]">
            <tr>
              {th("reg", "เลขครุภัณฑ์")}
              {th("name", "ชื่อ")}
              {th("facility", "หน่วยงาน")}
              {th("deleted", "ลบเมื่อ")}
              {th("by", "ลบโดย")}
              <th className="w-24 whitespace-nowrap px-4 py-2.5 text-center font-medium">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/4">
            {table.rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{row.assetNumber || row.assetRegistrationNo || <span className="text-[var(--muted)]">#{row.id}</span>}</td>
                <td className="px-4 py-2.5 font-medium">{row.assetName || "-"}</td>
                <td className="px-4 py-2.5">
                  {row.facilityName}
                  {row.districtName && <p className="text-xs text-[var(--muted)]">อ.{row.districtName}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{row.deletedAtLabel}</td>
                <td className="px-4 py-2.5">{row.deletedBy || "-"}</td>
                <td className="px-4 py-2 text-center">
                  {restoreButton(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination {...table} onPage={table.onPage} label="แบ่งหน้ารายการในถังขยะ" className="border-t border-black/6" />
    </>
  );
}
