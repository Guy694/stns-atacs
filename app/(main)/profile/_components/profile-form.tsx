"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/(main)/profile/actions";

type Props = {
  currentFullName: string;
  currentEmail: string;
};

export function ProfileForm({ currentFullName, currentEmail }: Props) {
  const [result, formAction, pending] = useActionState(updateProfileAction, null);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="section-title text-lg font-semibold">แก้ไขข้อมูลส่วนตัว</h2>

      {result === null && !pending ? null : result !== null ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{result}</div>
      ) : null}

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
          <input
            name="fullName"
            defaultValue={currentFullName}
            required
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={currentEmail}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </div>
      </form>
    </div>
  );
}
