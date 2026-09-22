"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createRepairAction, updateRepairAction } from "@/app/(main)/repairs/actions";
import {
  REPAIR_PRIORITIES,
  REPAIR_PRIORITY_LABELS,
  REPAIR_STATUS_LABELS,
  REPAIR_TRANSITIONS,
  type RepairStatus,
} from "@/lib/repair-options";

const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

function ErrorBox({ error }: { error: string | null }) {
  return error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null;
}

export function NewRepairForm({ assetId, assetStatus }: { assetId: number; assetStatus: string }) {
  const [error, formAction, pending] = useActionState(createRepairAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      <ErrorBox error={error} />
      <label className="block text-sm font-medium">อาการเสีย / ปัญหาที่พบ <span className="text-rose-500">*</span>
        <textarea name="problem" required rows={4} maxLength={2000} className={field} placeholder="เช่น เปิดไม่ติด มีกลิ่นไหม้ เครื่องพิมพ์กระดาษติดทุกครั้ง" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">ความเร่งด่วน
          <select name="priority" defaultValue="Normal" className={field}>
            {REPAIR_PRIORITIES.map((priority) => <option key={priority} value={priority}>{REPAIR_PRIORITY_LABELS[priority]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">ผู้ติดต่อ / เบอร์โทร
          <input name="contact" className={field} placeholder="ชื่อผู้แจ้ง / เบอร์ภายใน" />
        </label>
      </div>
      {assetStatus !== "Broken" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="markBroken" value="1" defaultChecked className="mt-0.5 accent-[var(--primary)]" />
          <span>เปลี่ยนสถานะทรัพย์สินเป็น “ชำรุด” ระหว่างรอซ่อม</span>
        </label>
      )}
      <div className="flex items-center justify-between pt-2">
        <Link href={`/assets/${assetId}`} className="rounded-xl border border-[var(--line)] bg-white/80 px-5 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white">ยกเลิก</Link>
        <button disabled={pending} className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
          {pending ? "กำลังบันทึก…" : "แจ้งซ่อม"}
        </button>
      </div>
    </form>
  );
}

type RepairFormValues = {
  id: number;
  status: RepairStatus;
  assignedTo: string;
  vendorName: string;
  diagnosis: string;
  resolution: string;
  cost: number | null;
};

export function UpdateRepairForm({ repair }: { repair: RepairFormValues }) {
  const [error, formAction, pending] = useActionState(updateRepairAction, null);
  const [status, setStatus] = useState<RepairStatus>(repair.status);
  const options = [repair.status, ...REPAIR_TRANSITIONS[repair.status]];
  const closing = status !== repair.status && (status === "Completed" || status === "Cancelled");
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="repairId" value={repair.id} />
      <ErrorBox error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">สถานะงาน
          <select name="status" value={status} onChange={(event) => setStatus(event.target.value as RepairStatus)} className={field}>
            {options.map((option) => <option key={option} value={option}>{option === repair.status ? `${REPAIR_STATUS_LABELS[option]} (ปัจจุบัน)` : REPAIR_STATUS_LABELS[option]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">ผู้รับผิดชอบ / ช่าง
          <input name="assignedTo" defaultValue={repair.assignedTo} className={field} />
        </label>
        <label className="block text-sm font-medium">ร้าน / บริษัทที่ส่งซ่อม
          <input name="vendorName" defaultValue={repair.vendorName} className={field} />
        </label>
        <label className="block text-sm font-medium">ค่าใช้จ่าย (บาท)
          <input name="cost" type="number" min="0" step="0.01" defaultValue={repair.cost ?? ""} className={field} placeholder="0.00" />
        </label>
      </div>
      <label className="block text-sm font-medium">ผลการตรวจสอบ / สาเหตุ
        <textarea name="diagnosis" rows={2} defaultValue={repair.diagnosis} className={field} />
      </label>
      <label className="block text-sm font-medium">ผลการซ่อม {status === "Completed" && <span className="text-rose-500">*</span>}
        <textarea name="resolution" rows={2} defaultValue={repair.resolution} required={status === "Completed"} className={field} placeholder="เช่น เปลี่ยน Power Supply ทดสอบใช้งานได้ปกติ" />
      </label>
      {closing && (
        <label className="block text-sm font-medium">สถานะทรัพย์สินหลังปิดงาน
          <select name="assetOutcome" defaultValue={status === "Completed" ? "Active" : ""} className={field}>
            <option value="">คงสถานะเดิม</option>
            <option value="Active">พร้อมใช้งาน</option>
            <option value="Broken">ชำรุด (ซ่อมไม่ได้ / รอเสนอจำหน่าย)</option>
            <option value="Inactive">ไม่ใช้งาน</option>
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">บันทึกเพิ่มเติมในไทม์ไลน์
        <input name="note" className={field} placeholder="เช่น รออะไหล่ 7 วัน" />
      </label>
      <button disabled={pending} className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
        {pending ? "กำลังบันทึก…" : "บันทึกงานซ่อม"}
      </button>
    </form>
  );
}
