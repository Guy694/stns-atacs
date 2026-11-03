"use client";

import { useActionState, useId } from "react";

import type { FacilityRow } from "@/lib/assets";
import { updateFacilitySelfAction } from "../actions";

type Props = {
  facility: FacilityRow;
  /** SEC-01: ประเภทหน่วยงาน/อำเภอกำหนดขอบเขตสิทธิ์ แก้ได้เฉพาะผู้ดูแลระบบ */
  canManageScope?: boolean;
};

export function FacilityEditForm({ facility, canManageScope = false }: Props) {
  const fieldId = useId();
  const [error, formAction, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => updateFacilitySelfAction(_prev, fd),
    null
  );

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">ข้อมูลหน่วยงาน</p>
          <h2 className="section-title mt-1 text-xl font-semibold">แก้ไขข้อมูลหน่วยงานนี้</h2>
        </div>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">Officer / Admin</span>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="facilityId" value={facility.id} />

        <div className="sm:col-span-2">
          <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium">ชื่อหน่วยงาน</label>
          <input id={`${fieldId}-name`} name="name" defaultValue={facility.name} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label htmlFor={`${fieldId}-typecode`} className="block text-sm font-medium">ประเภทหน่วยงาน</label>
          {canManageScope ? (
            <input id={`${fieldId}-typecode`} name="typecode" defaultValue={facility.typecode} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          ) : (
            <>
              <p className="mt-1 w-full rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-[var(--muted)]">{facility.typecode}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">แก้ไขได้โดยผู้ดูแลระบบเท่านั้น (มีผลต่อสิทธิ์การเข้าถึงข้อมูล)</p>
            </>
          )}
        </div>

        <div>
          <label htmlFor={`${fieldId}-districtName`} className="block text-sm font-medium">อำเภอ</label>
          {canManageScope ? (
            <input id={`${fieldId}-districtName`} name="districtName" defaultValue={facility.district_name ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          ) : (
            <>
              <p className="mt-1 w-full rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-[var(--muted)]">{facility.district_name ?? "-"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">แก้ไขได้โดยผู้ดูแลระบบเท่านั้น (มีผลต่อสิทธิ์การเข้าถึงข้อมูล)</p>
            </>
          )}
        </div>

        <div>
          <label htmlFor={`${fieldId}-tambon`} className="block text-sm font-medium">ตำบล</label>
          <input id={`${fieldId}-tambon`} name="tambon" defaultValue={facility.tambon ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label htmlFor={`${fieldId}-lat`} className="block text-sm font-medium">ละติจูด</label>
          <input id={`${fieldId}-lat`} name="lat" type="number" step="any" defaultValue={facility.lat ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label htmlFor={`${fieldId}-lon`} className="block text-sm font-medium">ลองจิจูด</label>
          <input id={`${fieldId}-lon`} name="lon" type="number" step="any" defaultValue={facility.lon ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={pending} className="rounded-xl bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {pending ? "กำลังบันทึก…" : "บันทึกข้อมูลหน่วยงาน"}
          </button>
        </div>
      </form>
    </div>
  );
}