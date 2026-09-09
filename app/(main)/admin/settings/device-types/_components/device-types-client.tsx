"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { createDeviceTypeAction, toggleDeviceTypeActiveAction, updateDeviceTypeAction } from "../actions";
import type { DeviceTypeRow } from "@/lib/device-types";

function DeviceTypeModal({
  mode,
  item,
  onClose,
}: {
  mode: "create" | "edit";
  item?: DeviceTypeRow;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const action = mode === "create" ? createDeviceTypeAction : updateDeviceTypeAction;
  const title = mode === "create" ? "เพิ่มประเภทอุปกรณ์" : `แก้ไข: ${item?.name}`;

  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const res = await action(prev, fd);
      if (!res) { onClose(); formRef.current?.reset(); }
      return res;
    },
    null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างประเภทอุปกรณ์"
            className="min-h-11 min-w-11 rounded-xl text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <form ref={formRef} action={formAction} className="mt-4 space-y-3">
          {mode === "edit" && <input type="hidden" name="id" value={item?.id} />}

          <div>
            <label className="block text-sm font-medium">ชื่อประเภท <span className="text-rose-500">*</span></label>
            <input name="name" defaultValue={item?.name ?? ""} required autoFocus
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </div>

          <div>
            <label className="block text-sm font-medium">หมวดหมู่ <span className="text-rose-500">*</span></label>
            <select name="category" defaultValue={item?.category ?? "Hardware"} required
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
              <option value="Hardware">Hardware (ฮาร์ดแวร์)</option>
              <option value="Software">Software (ซอฟต์แวร์)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-black/10 bg-white/80 px-5 py-2 text-sm font-medium hover:bg-white">
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}
              className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่ม" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeviceTypeItem({ item }: { item: DeviceTypeRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [togglePending, startToggle] = useTransition();

  return (
    <>
      <tr className="border-b border-black/5 transition hover:bg-white/40">
        <td className="px-4 py-3">
          <p className="text-sm font-medium">{item.name}</p>
        </td>
        <td className="px-4 py-3">
          <StatusBadge tone={item.category === "Hardware" ? "info" : "primary"}>
            {item.category}
          </StatusBadge>
        </td>
        <td className="px-4 py-3">
          <StatusBadge tone={activeTone(!!item.is_active)}>
            {item.is_active ? "ใช้งาน" : "ปิด"}
          </StatusBadge>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex gap-2">
            <button onClick={() => setEditOpen(true)}
              className="rounded-lg border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary-text)] hover:bg-[var(--primary-soft-strong)]">
              แก้ไข
            </button>
            <button
              onClick={() => startToggle(() => toggleDeviceTypeActiveAction(item.id, !item.is_active))}
              disabled={togglePending}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${item.is_active ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
              {togglePending ? "…" : item.is_active ? "ปิด" : "เปิด"}
            </button>
          </div>
        </td>
      </tr>
      {editOpen && <DeviceTypeModal mode="edit" item={item} onClose={() => setEditOpen(false)} />}
    </>
  );
}

export function DeviceTypesClient({ items }: { items: DeviceTypeRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const hw = items.filter((i) => i.category === "Hardware");
  const sw = items.filter((i) => i.category === "Software");

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
          + เพิ่มประเภทอุปกรณ์
        </button>
      </div>

      {[{ label: "Hardware (ฮาร์ดแวร์)", data: hw }, { label: "Software (ซอฟต์แวร์)", data: sw }].map(({ label, data }) => (
        <div key={label} className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/6 bg-stone-50/60 px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">ชื่อประเภท</th>
                  <th className="px-4 py-2.5 text-left font-medium">หมวด</th>
                  <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
                  <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => <DeviceTypeItem key={item.id} item={item} />)}
                {data.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {createOpen && <DeviceTypeModal mode="create" onClose={() => setCreateOpen(false)} />}
    </>
  );
}
