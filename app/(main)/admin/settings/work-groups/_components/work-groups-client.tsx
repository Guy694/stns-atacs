"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import {
  createFacilityWorkGroupAction,
  toggleFacilityWorkGroupActiveAction,
} from "@/app/(main)/admin/settings/work-groups/actions";
import type {
  FacilityWorkGroupManageRow,
  WorkGroupFacilityOption,
} from "@/lib/facility-work-groups";

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
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)]"
          >
            x
          </button>
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
            <label className="block">
              <span className="text-sm font-medium text-[var(--foreground)]">หน่วยงาน</span>
              <select
                name="facilityId"
                required
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
              >
                <option value="">เลือกหน่วยงาน</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} · {facility.districtName ?? "-"} · {facility.typecode}
                  </option>
                ))}
              </select>
            </label>
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
              className="rounded-xl border border-black/10 bg-white/80 px-5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "กำลังบันทึก..." : "สร้างกลุ่มงาน"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkGroupRow({ workGroup }: { workGroup: FacilityWorkGroupManageRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-black/5 transition hover:bg-white/40">
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
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await toggleFacilityWorkGroupActiveAction(workGroup.id, !workGroup.isActive);
              router.refresh();
            })
          }
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
            workGroup.isActive
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {pending ? "..." : workGroup.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </button>
      </td>
    </tr>
  );
}

export function WorkGroupsClient({ facilities, workGroups }: WorkGroupsClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const activeCount = workGroups.filter((group) => group.isActive).length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs text-[var(--muted)]">หน่วยงานที่จัดการได้</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{facilities.length}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs text-[var(--muted)]">กลุ่มงานทั้งหมด</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{workGroups.length}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs text-[var(--muted)]">เปิดใช้งาน</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{activeCount}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={facilities.length === 0}
          className="rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + สร้างกลุ่มงาน
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
              <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                <th className="px-4 py-3 text-left font-medium">กลุ่มงาน</th>
                <th className="px-4 py-3 text-left font-medium">หน่วยงาน</th>
                <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                <th className="px-4 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {workGroups.map((workGroup) => (
                <WorkGroupRow key={workGroup.id} workGroup={workGroup} />
              ))}
              {workGroups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                    ยังไม่มีกลุ่มงาน กดสร้างกลุ่มงานเพื่อเริ่มใช้งาน
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? <WorkGroupModal facilities={facilities} onClose={() => setCreateOpen(false)} /> : null}
    </>
  );
}
