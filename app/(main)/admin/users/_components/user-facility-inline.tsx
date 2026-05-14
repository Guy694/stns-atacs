"use client";

import { useActionState } from "react";

import { updateUserFacilityAction } from "@/app/(main)/admin/users/actions";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
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

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />

      <div className="flex items-center gap-2">
        <select
          name="facilityId"
          defaultValue={currentFacilityId?.toString() ?? ""}
          disabled={disabled || pending}
          className="min-w-[180px] rounded-lg border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">— ไม่ระบุ —</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.facility_name} {f.district_name ? `· อ.${f.district_name}` : ""}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={disabled || pending}
          className="rounded-lg border border-black/10 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-[var(--accent-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "..." : "บันทึก"}
        </button>
      </div>

      {disabled && <p className="text-[10px] text-[var(--muted)]">ใช้เฉพาะ role Officer</p>}
      {error && <p className="text-[10px] text-rose-600">{error}</p>}
    </form>
  );
}
