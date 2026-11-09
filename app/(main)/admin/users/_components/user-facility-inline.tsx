"use client";

import { useActionState, useMemo } from "react";

import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { updateUserFacilityAction } from "@/app/(main)/admin/users/actions";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
  typecode?: string | null;
};

type Props = {
  userId: number;
  role: "admin" | "officer" | "viewer";
  currentFacilityId: number | null;
  facilities: FacilityOption[];
};

export function UserFacilityInline({ userId, role, currentFacilityId, facilities }: Props) {
  const [error, formAction, pending] = useActionState(
    async (_prev: string | null, fd: FormData) => updateUserFacilityAction(_prev, fd),
    null
  );

  const disabled = role !== "officer";
  const facilityOptions = useMemo(() => facilities.map((f) => ({ id: f.id, name: f.facility_name, typecode: f.typecode, districtName: f.district_name })), [facilities]);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />

      <div className="flex items-center gap-2">
        {/* เปลี่ยนแล้วบันทึกทันที (auto-save) — ไม่ต้องกดปุ่มบันทึก */}
        <FacilitySelect
          name="facilityId"
          facilities={facilityOptions}
          defaultValue={currentFacilityId?.toString() ?? ""}
          emptyLabel="— ไม่ระบุ —"
          disabled={disabled || pending}
          autoSubmit
          aria-label="หน่วยงานของผู้ใช้"
          className="min-w-[200px]"
        />
        {pending && (
          <span role="status" className="inline-flex items-center text-[var(--muted)]">
            <AppIcon name="refresh" size={15} className="animate-spin" />
            <span className="sr-only">กำลังบันทึก</span>
          </span>
        )}
      </div>

      {disabled && <p className="text-[10px] text-[var(--muted)]">ใช้เฉพาะ role Officer</p>}
      {error && <p className="text-[10px] text-rose-600">{error}</p>}
    </form>
  );
}
