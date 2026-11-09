"use client";

import { useActionState, useState } from "react";

import { setRoundStatusAction } from "@/app/(main)/inspection/actions";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { AppIcon } from "@/app/_components/ui/icon";

type Props = { inspectionId: number; status: "Open" | "Closed"; remainingItems: number; closedBy: string; closedAtLabel: string };

/** Close locks results (no more edits); reopen unlocks them. Both are logged. */
export function RoundStatusControl({ inspectionId, status, remainingItems, closedBy, closedAtLabel }: Props) {
  const [error, formAction, pending] = useActionState(setRoundStatusAction, null);
  const [confirming, setConfirming] = useState(false);

  if (status === "Closed") {
    return (
      <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
        <input type="hidden" name="inspectionId" value={inspectionId} />
        <input type="hidden" name="status" value="Open" />
        <div className="flex items-center gap-2">
          <p className="text-sm text-[var(--foreground)]">ปิดรอบแล้ว{closedBy ? ` โดย ${closedBy}` : ""}{closedAtLabel ? ` · ${closedAtLabel}` : ""}</p>
          <ActionIconButton type="submit" icon={pending ? "refresh" : "power-on"} tone="primary" disabled={pending} label={pending ? "กำลังเปิดรอบ…" : "เปิดรอบอีกครั้งเพื่อแก้ไขผล"} />
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
    );
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="primary-action">
        <AppIcon name="power-off" className="h-4 w-4" /> ปิดรอบตรวจนับ
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-md space-y-2 rounded-xl border border-[var(--line)] bg-white p-4 text-sm">
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <input type="hidden" name="status" value="Closed" />
      <p className="font-semibold">ปิดรอบตรวจนับ?</p>
      <p className="text-[var(--muted)]">เมื่อปิดแล้วจะบันทึกหรือแก้ผลตรวจ คณะกรรมการ และลบรอบไม่ได้ จนกว่าจะเปิดรอบอีกครั้ง รายงานผลการตรวจสอบจะใช้ข้อมูล ณ เวลาที่ปิด</p>
      {remainingItems > 0 && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
          <input type="checkbox" name="confirmPending" value="1" required className="mt-1" />
          <span>ยังมี {remainingItems.toLocaleString("th-TH")} รายการที่ยังไม่ได้ตรวจ ยืนยันปิดรอบโดยให้รายการเหล่านี้เป็น “ยังไม่ได้ตรวจ”</span>
        </label>
      )}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button disabled={pending} className="primary-action"><AppIcon name="check" className="h-4 w-4" />{pending ? "กำลังปิดรอบ…" : "ยืนยันปิดรอบ"}</button>
        <ActionIconButton icon="close" label="ยกเลิก" onClick={() => setConfirming(false)} />
      </div>
    </form>
  );
}
