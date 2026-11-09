"use client";

import { useActionState, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { EmptyState, SummaryCard } from "@/app/(main)/admin/_components/page-hero";
import { compareFacilities } from "@/lib/facility-order";
import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import {
  createFacilityWorkGroupAction,
  toggleFacilityWorkGroupActiveAction,
} from "@/app/(main)/admin/settings/work-groups/actions";
import { useTableState } from "@/app/_components/ui/use-table-state";
import type {
  FacilityWorkGroupManageRow,
  WorkGroupFacilityOption,
} from "@/lib/facility-work-groups";
import { useEscapeToClose } from "@/app/_components/ui/use-escape-to-close";

type WorkGroupsClientProps = {
  facilities: WorkGroupFacilityOption[];
  workGroups: FacilityWorkGroupManageRow[];
};

function WorkGroupModal({
  facilities,
  onClose,
}: {
  facilities: WorkGroupFacilityOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [error, formAction, pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const result = await createFacilityWorkGroupAction(null, formData);
      if (!result) {
        formRef.current?.reset();
        onClose();
        router.refresh();
      }
      return result;
    },
    null
  );

  const singleFacility = facilities.length === 1 ? facilities[0] : null;
  useEscapeToClose(!pending, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="ปิดหน้าต่างสร้างกลุ่มงาน"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
              สร้างกลุ่มงาน
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ใช้ผูกกับหน่วยงานตอนสร้าง token ติดตั้ง ATACS Agent
            </p>
          </div>
          <ActionIconButton icon="close" label="ปิด" onClick={onClose} className="-mr-2 -mt-2 border-transparent bg-transparent" />
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form ref={formRef} action={formAction} className="mt-5 space-y-4">
          {singleFacility ? (
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <p className="text-xs text-[var(--muted)]">หน่วยงาน</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{singleFacility.name}</p>
              <input type="hidden" name="facilityId" value={singleFacility.id} />
            </div>
          ) : (
            <div>
              <label htmlFor={`${titleId}-facility`} className="text-sm font-medium text-[var(--foreground)]">หน่วยงาน</label>
              <FacilitySelect
                id={`${titleId}-facility`}
                name="facilityId"
                facilities={facilities}
                required
                className="mt-1"
              />
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ชื่อกลุ่มงาน</span>
            <input
              name="workGroupName"
              required
              autoFocus
              minLength={2}
              maxLength={150}
              placeholder="เช่น กลุ่มงานไอที / OPD / งานการเงิน"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="secondary-action"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending}
              className="primary-action"
            >
              <AppIcon name="plus" size={16} />
              {pending ? "กำลังบันทึก..." : "สร้างกลุ่มงาน"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkGroupRow({ workGroup, seq }: { workGroup: FacilityWorkGroupManageRow; seq: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-black/5">
      <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{seq.toLocaleString("th-TH")}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--foreground)]">{workGroup.workGroupName}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--foreground)]">{workGroup.facilityName}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {workGroup.districtName ?? "-"} · {workGroup.facilityTypeCode}
        </p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge tone={activeTone(workGroup.isActive)}>
          {workGroup.isActive ? "ใช้งาน" : "ปิด"}
        </StatusBadge>
      </td>
      <td className="px-4 py-3 text-right">
        <ActionIconButton
          icon={workGroup.isActive ? "power-off" : "power-on"}
          tone={workGroup.isActive ? "danger" : "primary"}
          label={workGroup.isActive ? `ปิดใช้งานกลุ่มงาน ${workGroup.workGroupName}` : `เปิดใช้งานกลุ่มงาน ${workGroup.workGroupName}`}
          aria-busy={pending}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await toggleFacilityWorkGroupActiveAction(workGroup.id, !workGroup.isActive);
              router.refresh();
            })
          }
        />
      </td>
    </tr>
  );
}

export function WorkGroupsClient({ facilities, workGroups }: WorkGroupsClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const activeCount = workGroups.filter((group) => group.isActive).length;
  // ลำดับเริ่มต้นตามหน่วยงาน: สสจ. → สสอ. → รพท. → รพช. → รพ.สต.
  const ordered = useMemo(
    () =>
      [...workGroups].sort(
        (a, b) =>
          compareFacilities({ name: a.facilityName, typecode: a.facilityTypeCode }, { name: b.facilityName, typecode: b.facilityTypeCode }) ||
          a.workGroupName.localeCompare(b.workGroupName, "th")
      ),
    [workGroups]
  );
  const t = useTableState(ordered, {
    name: (group) => group.workGroupName,
    facility: (group) => group.facilityName,
    status: (group) => (group.isActive ? 0 : 1),
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon="building" image="office-desk" label="หน่วยงานที่จัดการได้" value={facilities.length.toLocaleString("th-TH")} />
        <SummaryCard icon="users" image="meeting-room" label="กลุ่มงานทั้งหมด" value={workGroups.length.toLocaleString("th-TH")} />
        <SummaryCard icon="power-on" image="it-storage" label="เปิดใช้งาน" value={activeCount.toLocaleString("th-TH")} tone="success" />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={facilities.length === 0}
          className="primary-action"
        >
          <AppIcon name="plus" size={16} />
          สร้างกลุ่มงาน
        </button>
      </div>

      <section className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-black/6 px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">รายการกลุ่มงาน</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            กลุ่มงานเหล่านี้จะแสดงเป็นตัวเลือกตอนสร้าง enrollment token
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/6 text-xs text-[var(--muted)]">
                <th className="w-14 px-4 py-3 text-right font-medium">ลำดับ</th>
                <SortableTh label="กลุ่มงาน" sortKey="name" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
                <SortableTh label="หน่วยงาน" sortKey="facility" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
                <SortableTh label="สถานะ" sortKey="status" sort={t.sort} onSort={t.onSort} className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((workGroup, rowIndex) => (
                <WorkGroupRow key={workGroup.id} workGroup={workGroup} seq={t.start + rowIndex} />
              ))}
              {workGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState icon="users" image="meeting-room" title="ยังไม่มีกลุ่มงาน" description="กด “สร้างกลุ่มงาน” เพื่อเริ่มใช้งาน" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination {...t} onPage={t.onPage} label="แบ่งหน้ากลุ่มงาน" className="border-t border-black/6" />
      </section>

      {createOpen ? <WorkGroupModal facilities={facilities} onClose={() => setCreateOpen(false)} /> : null}
    </>
  );
}
