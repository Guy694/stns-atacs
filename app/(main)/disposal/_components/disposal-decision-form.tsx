"use client";

import { useActionState } from "react";

import { cancelDisposalAction, decideDisposalAction, recordExecutionAction } from "@/app/(main)/disposal/actions";

const field = "w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function DisposalDecisionForm({ requestId, requestType }: { requestId: number; requestType: "Disposed" | "Lost" }) {
  const [error, formAction, pending] = useActionState(decideDisposalAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">เลขที่หนังสืออนุมัติ
          <input name="approvalDocumentNo" className={`${field} mt-1`} placeholder="เช่น สต 0033/2570" />
        </label>
        {requestType === "Disposed" && (
          <p className="self-end text-xs text-[var(--muted)]">หลังอนุมัติ ให้บันทึกวันที่ขาย/โอน/ทำลายจริง เลขที่หลักฐาน และเงินที่ได้รับ ในขั้น “บันทึกผลการจำหน่าย”</p>
        )}
      </div>
      <label className="block text-sm font-medium">ความเห็น / เหตุผล (จำเป็นเมื่อไม่อนุมัติ)
        <textarea name="decisionNote" rows={2} className={`${field} mt-1`} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="Approved" disabled={pending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
          อนุมัติ{requestType === "Lost" ? "บันทึกสูญหาย" : "จำหน่าย"}
        </button>
        <button name="decision" value="Rejected" disabled={pending} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60">
          ไม่อนุมัติ
        </button>
      </div>
    </form>
  );
}

export function CancelDisposalForm({ requestId }: { requestId: number }) {
  const [error, formAction, pending] = useActionState(cancelDisposalAction, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      <button disabled={pending} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-stone-50 disabled:opacity-60">
        ยกเลิกคำขอ
      </button>
      {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
    </form>
  );
}

/** After approval: when and how the item actually left the register, with the money received. */
export function DisposalExecutionForm({ requestId, defaults }: { requestId: number; defaults?: { executedOn?: string; documentNo?: string; proceedsAmount?: number | null; note?: string } }) {
  const [error, formAction, pending] = useActionState(recordExecutionAction, null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">วันที่ดำเนินการ
          <input name="executedOn" type="date" required max={today} defaultValue={defaults?.executedOn || today} className={`${field} mt-1`} />
        </label>
        <label className="text-sm font-medium">เลขที่ใบเสร็จ / หลักฐาน
          <input name="executionDocumentNo" defaultValue={defaults?.documentNo ?? ""} maxLength={100} className={`${field} mt-1`} placeholder="เช่น ใบเสร็จเล่มที่ 12 เลขที่ 345" />
        </label>
        <label className="text-sm font-medium">เงินที่ได้รับ (บาท)
          <input name="proceedsAmount" type="number" min="0" step="0.01" defaultValue={defaults?.proceedsAmount ?? ""} className={`${field} mt-1`} placeholder="เว้นว่างถ้าไม่มี" />
        </label>
      </div>
      <label className="block text-sm font-medium">หมายเหตุ
        <textarea name="executionNote" rows={2} defaultValue={defaults?.note ?? ""} className={`${field} mt-1`} placeholder="เช่น ขายทอดตลาดให้ผู้เสนอราคาสูงสุด / ส่งมอบให้ ... / ทำลายโดยคณะกรรมการ" />
      </label>
      <button disabled={pending} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
        {pending ? "กำลังบันทึก…" : "บันทึกผลการจำหน่าย"}
      </button>
    </form>
  );
}
