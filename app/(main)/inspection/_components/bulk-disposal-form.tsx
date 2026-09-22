"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { bulkDisposalFromInspectionAction, type BulkDisposalResult } from "@/app/(main)/disposal/actions";
import { DISPOSAL_METHODS } from "@/lib/disposal-options";

type Row = { assetId: number; number: string; name: string; outcome: "broken" | "unused" | "missing"; outcomeLabel: string; pendingRequestId: number | null };

const field = "mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm";

/** Select broken / unused / missing items from the round and raise their disposal or loss requests together. */
export function BulkDisposalForm({ inspectionId, roundName, rows }: { inspectionId: number; roundName: string; rows: Row[] }) {
  const [result, formAction, pending] = useActionState<BulkDisposalResult, FormData>(bulkDisposalFromInspectionAction, null);
  const selectable = rows.filter((row) => !row.pendingRequestId);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(selectable.map((row) => row.assetId)));
  const needsMethod = rows.some((row) => selected.has(row.assetId) && row.outcome !== "missing");
  const toggle = (id: number) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.assetId));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-xs text-[var(--muted)]">
            <tr>
              <th scope="col" className="w-10 px-3 py-2 text-left">
                <input type="checkbox" aria-label="เลือกทั้งหมด" checked={allSelected} disabled={!selectable.length}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((row) => row.assetId)))} />
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">เลขครุภัณฑ์ / รายการ</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">ผลตรวจ</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">จะเสนอเป็น</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((row) => (
              <tr key={row.assetId} className={row.pendingRequestId ? "text-[var(--muted)]" : undefined}>
                <td className="px-3 py-2">
                  {row.pendingRequestId ? null : (
                    <input type="checkbox" name="assetIds" value={row.assetId} checked={selected.has(row.assetId)} onChange={() => toggle(row.assetId)} aria-label={`เลือก ${row.number || row.name}`} />
                  )}
                </td>
                <td className="px-3 py-2"><span className="font-mono text-xs">{row.number || "-"}</span><span className="block">{row.name}</span></td>
                <td className="px-3 py-2">{row.outcomeLabel}</td>
                <td className="px-3 py-2">
                  {row.pendingRequestId
                    ? <Link href={`/disposal?requestId=${row.pendingRequestId}`} className="text-[var(--primary-text)] underline">มีคำขอรออนุมัติ #{row.pendingRequestId}</Link>
                    : row.outcome === "missing" ? "บันทึกสูญหาย" : "จำหน่าย"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">วิธีการจำหน่าย (รายการชำรุด/เสื่อมสภาพ){needsMethod && <span className="text-rose-500"> *</span>}
          <select name="disposalMethod" required={needsMethod} defaultValue="" className={field}>
            <option value="" disabled>-- เลือกวิธีการจำหน่าย --</option>
            {DISPOSAL_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">วันที่เสนอ
          <input type="date" name="eventDate" defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} className={field} />
        </label>
      </div>
      <label className="block text-sm font-medium">เหตุผล <span className="text-rose-500">*</span>
        <textarea name="reason" required rows={2} className={field} defaultValue={`ผลการตรวจสอบพัสดุ ${roundName} โดยคณะกรรมการตรวจสอบพัสดุ`} />
      </label>
      {result && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          <p className="font-semibold">{result.message}</p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">{result.skipped.map((line) => <li key={line}>{line}</li>)}</ul>
          )}
        </div>
      )}
      <button disabled={pending || selected.size === 0} className="min-h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
        {pending ? "กำลังสร้างคำขอ…" : `เสนอจำหน่าย/สูญหาย ${selected.size} รายการ`}
      </button>
      <p className="text-xs text-[var(--muted)]">สถานะในทะเบียนยังไม่เปลี่ยนจนกว่าผู้มีสิทธิ์อนุมัติแต่ละคำขอ ผู้เสนออนุมัติคำขอของตนเองไม่ได้</p>
    </form>
  );
}
