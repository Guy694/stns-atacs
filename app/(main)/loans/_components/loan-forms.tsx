"use client";

import { useActionState } from "react";

import { cancelLoanAction, createLoanAction, returnLoanAction } from "@/app/(main)/loans/actions";
import { todayBangkok } from "@/lib/local-date";
import { SubmitButton } from "@/app/_components/ui/submit-button";
import { actionIconClass } from "@/app/_components/ui/action-icon-button";
import { AppIcon } from "@/app/_components/ui/icon";

const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function NewLoanForm({ assetId }: { assetId: number }) {
  const [error, formAction, pending] = useActionState(createLoanAction, null);
  const today = todayBangkok();
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">ชื่อผู้ยืม <span className="text-rose-600">*</span>
          <input name="borrowerName" required maxLength={255} className={field} />
        </label>
        <label className="text-sm font-medium">หน่วยงาน / กลุ่มงานของผู้ยืม
          <input name="borrowerUnit" maxLength={255} className={field} placeholder="เช่น กลุ่มงานควบคุมโรค" />
        </label>
        <label className="text-sm font-medium">เบอร์ติดต่อ
          <input name="borrowerContact" maxLength={255} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">วันที่ยืม
            <input name="loanedOn" type="date" required max={today} defaultValue={today} className={field} />
          </label>
          <label className="text-sm font-medium">กำหนดคืน
            <input name="dueOn" type="date" required min={today} defaultValue={addDays(today, 7)} className={field} />
          </label>
        </div>
      </div>
      <label className="block text-sm font-medium">วัตถุประสงค์ / ใช้งานที่ <span className="text-rose-600">*</span>
        <textarea name="purpose" required rows={3} maxLength={2000} className={field} placeholder="เช่น ใช้ออกหน่วยคัดกรองโรคที่ รพ.สต. ..." />
      </label>
      <p className="text-xs text-[var(--muted)]">การยืมไม่เปลี่ยนหน่วยงานเจ้าของ หากนำไปใช้ถาวรให้โอนย้ายแทน</p>
      <button disabled={pending} className="primary-action">
        <AppIcon name="check" className="h-4 w-4" />
        {pending ? "กำลังบันทึก…" : "บันทึกการยืม"}
      </button>
    </form>
  );
}

export function ReturnLoanForm({ loanId, loanedOn }: { loanId: number; loanedOn: string }) {
  const [result, formAction, pending] = useActionState(returnLoanAction, null);
  const today = todayBangkok();
  if (result === "saved") return <p role="status" className="text-sm text-[#006300]">บันทึกการรับคืนแล้ว</p>;
  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[9rem_9rem_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="loanId" value={loanId} />
      <label className="text-xs text-[var(--muted)]">วันที่คืน
        <input name="returnedOn" type="date" required min={loanedOn} max={today} defaultValue={today} className={field} />
      </label>
      <label className="text-xs text-[var(--muted)]">สภาพ
        <select name="condition" defaultValue="Good" className={field}>
          <option value="Good">สภาพปกติ</option>
          <option value="Damaged">ชำรุด (เปลี่ยนสถานะเป็นชำรุด)</option>
        </select>
      </label>
      <label className="text-xs text-[var(--muted)]">หมายเหตุ
        <input name="returnNote" maxLength={500} className={field} />
      </label>
      <button disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"><AppIcon name="undo" className="h-4 w-4" />{pending ? "…" : "รับคืน"}</button>
      {result && <p role="alert" className="text-xs text-rose-700 sm:col-span-4">{result}</p>}
    </form>
  );
}

export function CancelLoanButton({ loanId }: { loanId: number }) {
  const [result, formAction] = useActionState(cancelLoanAction, null);
  if (result === "saved") return <span className="text-xs text-[var(--muted)]">ยกเลิกแล้ว</span>;
  return (
    <form action={formAction} className="inline-flex items-center" title="ยกเลิกรายการยืม (บันทึกผิด)">
      <input type="hidden" name="loanId" value={loanId} />
      <SubmitButton
        ariaLabel="ยกเลิกรายการยืม (บันทึกผิด)"
        pendingText={<AppIcon name="refresh" className="h-4 w-4 animate-spin" />}
        confirm={{ title: "ยกเลิกรายการยืมนี้?", text: "ใช้เมื่อบันทึกผิดเท่านั้น รายการจะถูกทำเครื่องหมายว่ายกเลิก", confirmText: "ยกเลิกรายการยืม", danger: true }}
        className={actionIconClass("danger")}
      >
        <AppIcon name="close" className="h-4 w-4" />
      </SubmitButton>
      {result && <span role="alert" className="ml-2 text-xs text-rose-700">{result}</span>}
    </form>
  );
}
