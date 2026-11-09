"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";

import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { AppIcon } from "@/app/_components/ui/icon";
import { useTableState } from "@/app/_components/ui/use-table-state";
import { EmptyState } from "@/app/(main)/admin/_components/page-hero";
import { createDeviceTypeAction, toggleDeviceTypeActiveAction, updateDeviceTypeAction } from "../actions";
import type { DeviceTypeRow } from "@/lib/device-types";
import { useEscapeToClose } from "@/app/_components/ui/use-escape-to-close";

function DeviceTypeModal({
  mode,
  item,
  onClose,
}: {
  mode: "create" | "edit";
  item?: DeviceTypeRow;
  onClose: () => void;
}) {
  const fieldId = useId();
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
  useEscapeToClose(!pending, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <ActionIconButton icon="close" label="ปิดหน้าต่างประเภทอุปกรณ์" onClick={onClose} className="-mr-2 border-transparent bg-transparent" />
        </div>

        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <form ref={formRef} action={formAction} className="mt-4 space-y-3">
          {mode === "edit" && <input type="hidden" name="id" value={item?.id} />}

          <div>
            <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium">ชื่อประเภท <span className="text-rose-500">*</span></label>
            <input id={`${fieldId}-name`} name="name" defaultValue={item?.name ?? ""} required autoFocus
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </div>

          <div>
            <label htmlFor={`${fieldId}-category`} className="block text-sm font-medium">หมวดหมู่ <span className="text-rose-500">*</span></label>
            <select id={`${fieldId}-category`} name="category" defaultValue={item?.category ?? "Hardware"} required
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
              <option value="Hardware">Hardware (ฮาร์ดแวร์)</option>
              <option value="Software">Software (ซอฟต์แวร์)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="secondary-action">
              ยกเลิก
            </button>
            <button type="submit" disabled={pending} className="primary-action">
              <AppIcon name={mode === "create" ? "plus" : "check"} size={16} />
              {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่ม" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeviceTypeItem({ item, seq }: { item: DeviceTypeRow; seq: number }) {
  const [editOpen, setEditOpen] = useState(false);
  const [togglePending, startToggle] = useTransition();

  return (
    <>
      <tr className="border-b border-black/5">
        <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{seq.toLocaleString("th-TH")}</td>
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
            <ActionIconButton icon="pencil" tone="primary" label={`แก้ไข ${item.name}`} onClick={() => setEditOpen(true)} />
            <ActionIconButton
              icon={item.is_active ? "power-off" : "power-on"}
              tone={item.is_active ? "danger" : "primary"}
              label={item.is_active ? `ปิดใช้งาน ${item.name}` : `เปิดใช้งาน ${item.name}`}
              aria-busy={togglePending}
              disabled={togglePending}
              onClick={() => startToggle(() => toggleDeviceTypeActiveAction(item.id, !item.is_active))}
            />
          </div>
        </td>
      </tr>
      {editOpen && <DeviceTypeModal mode="edit" item={item} onClose={() => setEditOpen(false)} />}
    </>
  );
}

const deviceTypeAccessors: Record<string, (item: DeviceTypeRow) => unknown> = {
  name: (item) => item.name,
  category: (item) => item.category,
  status: (item) => (item.is_active ? 0 : 1),
};

function DeviceTypeTable({ label, data }: { label: string; data: DeviceTypeRow[] }) {
  const t = useTableState(data, deviceTypeAccessors);

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="border-b border-black/6 px-4 py-2.5">
        <h2 className="text-xs font-semibold text-[var(--muted)]">{label}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/6 text-xs text-[var(--muted)]">
              <th className="w-14 px-4 py-2.5 text-right font-medium">ลำดับ</th>
              <SortableTh label="ชื่อประเภท" sortKey="name" sort={t.sort} onSort={t.onSort} />
              <SortableTh label="หมวด" sortKey="category" sort={t.sort} onSort={t.onSort} />
              <SortableTh label="สถานะ" sortKey="status" sort={t.sort} onSort={t.onSort} />
              <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((item, rowIndex) => <DeviceTypeItem key={item.id} item={item} seq={t.start + rowIndex} />)}
            {data.length === 0 && (
              <tr><td colSpan={5} className="p-0"><EmptyState icon="layers" image="it-storage" title="ยังไม่มีประเภทอุปกรณ์ในหมวดนี้" className="py-8" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination {...t} onPage={t.onPage} label={`แบ่งหน้า${label}`} className="border-t border-black/6" />
    </div>
  );
}

export function DeviceTypesClient({ items }: { items: DeviceTypeRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const hw = items.filter((i) => i.category === "Hardware");
  const sw = items.filter((i) => i.category === "Software");

  return (
    <>
      <div className="flex justify-end">
        <button type="button" onClick={() => setCreateOpen(true)} className="primary-action">
          <AppIcon name="plus" size={16} />
          เพิ่มประเภทอุปกรณ์
        </button>
      </div>

      {[{ label: "Hardware (ฮาร์ดแวร์)", data: hw }, { label: "Software (ซอฟต์แวร์)", data: sw }].map(({ label, data }) => (
        <DeviceTypeTable key={label} label={label} data={data} />
      ))}

      {createOpen && <DeviceTypeModal mode="create" onClose={() => setCreateOpen(false)} />}
    </>
  );
}
