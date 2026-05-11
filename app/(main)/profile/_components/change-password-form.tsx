"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/(main)/profile/actions";

export function ChangePasswordForm() {
  const [error, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="section-title text-lg font-semibold">เปลี่ยนรหัสผ่าน</h2>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">รหัสผ่านปัจจุบัน</label>
          <input
            name="currentPassword"
            type="password"
            required
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">รหัสผ่านใหม่ (≥ 8 ตัวอักษร)</label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">ยืนยันรหัสผ่านใหม่</label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      </form>
    </div>
  );
}
