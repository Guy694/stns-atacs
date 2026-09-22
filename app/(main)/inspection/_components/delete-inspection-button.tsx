"use client";

import { useActionState, useState } from "react";

import { deleteInspectionAction } from "@/app/(main)/inspection/actions";

type Props = { inspectionId: number; roundName: string; totalItems: number; checkedItems: number; defaultOpen?: boolean };

/** Two-step delete: reveal the warning, then type the round name to enable the permanent delete. */
export function DeleteInspectionButton({ inspectionId, roundName, totalItems, checkedItems, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [typed, setTyped] = useState("");
  const [error, formAction, pending] = useActionState(deleteInspectionAction, null);
  const matches = typed.trim() === roundName.trim();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
        ยกเลิกและลบรอบตรวจนับนี้
      </button>
    );
  }

  return (
    <form id="delete-round" action={formAction} className="w-full max-w-xl space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm" aria-labelledby={`delete-${inspectionId}`}>
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <p id={`delete-${inspectionId}`} className="font-semibold text-rose-800">ลบรอบตรวจนับ “{roundName}” ออกจากระบบถาวร?</p>
      <ul className="list-disc space-y-1 pl-5 text-rose-900">
        <li>ลบรอบนี้และรายการในรอบทั้งหมด {totalItems.toLocaleString("th-TH")} รายการ รวมผลตรวจที่บันทึกแล้ว {checkedItems.toLocaleString("th-TH")} รายการ</li>
        <li>ลบแล้วกู้คืนไม่ได้ ถ้าต้องเก็บผลไว้ ให้ดาวน์โหลดใบตรวจนับ Excel ก่อน</li>
        <li>ทะเบียนครุภัณฑ์ สถานะปัจจุบัน และประวัติสถานะไม่ถูกลบหรือเปลี่ยนแปลง</li>
      </ul>
      <label className="block font-medium text-rose-900">เหตุผล (ไม่บังคับ)
        <input name="reason" maxLength={500} className="mt-1 min-h-11 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm" placeholder="เช่น เปิดรอบซ้ำ เลือกหน่วยงานผิด" />
      </label>
      <label className="block font-medium text-rose-900">พิมพ์ชื่อรอบ <span className="font-mono">{roundName}</span> เพื่อยืนยัน
        <input name="confirmName" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" required
          className="mt-1 min-h-11 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm" />
      </label>
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !matches} className="min-h-11 rounded-lg bg-rose-600 px-4 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "กำลังลบ…" : "ลบรอบตรวจนับถาวร"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setTyped(""); }} disabled={pending} className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-4 text-[var(--foreground)] hover:bg-stone-50">
          ไม่ลบ
        </button>
      </div>
    </form>
  );
}
