"use client";

import { useActionState } from "react";
import { updateFacilityAction } from "@/app/(main)/profile/actions";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
};

type Props = {
  currentFacilityId: number | null;
  facilities: FacilityOption[];
};

export function FacilityForm({ currentFacilityId, facilities }: Props) {
  const [result, formAction, pending] = useActionState(updateFacilityAction, null);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="section-title text-lg font-semibold">หน่วยงานที่สังกัด</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        กำหนดหน่วยงานที่คุณสังกัด เพื่อให้ระบบแสดงข้อมูลและ agent token ที่ถูกต้อง
      </p>

      {result && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {result}
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">
            หน่วยงาน <span className="text-rose-500">*</span>
          </label>
          <select
            name="facilityId"
            required
            defaultValue={currentFacilityId?.toString() ?? ""}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">— เลือกหน่วยงาน —</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.facility_name}
                {f.district_name ? ` · อ.${f.district_name}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก…" : "บันทึกหน่วยงาน"}
          </button>
        </div>
      </form>
    </div>
  );
}
