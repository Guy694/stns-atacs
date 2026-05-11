"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { toggleUserActiveAction, updateUserRoleAction, resetUserPasswordAction } from "@/app/(main)/admin/users/actions";

type Props = {
  userId: number;
  currentActive: boolean;
  currentRole: "admin" | "officer";
  hasUsername: boolean;
  isSelf: boolean;
};

export function UserRowActions({ userId, currentActive, currentRole, hasUsername, isSelf }: Props) {
  const [showReset, setShowReset] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [rolePending, startRole] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [resetError, resetAction, resetPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const res = await resetUserPasswordAction(prev, fd);
      if (!res) setShowReset(false);
      return res;
    },
    null
  );

  return (
    <div className="inline-flex items-center gap-2">
      {/* Toggle active */}
      {!isSelf && (
        <button
          onClick={() => startToggle(() => toggleUserActiveAction(userId, currentActive))}
          disabled={togglePending}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
            currentActive
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {togglePending ? "…" : currentActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </button>
      )}

      {/* Toggle role */}
      {!isSelf && (
        <button
          onClick={() => startRole(() => updateUserRoleAction(userId, currentRole === "admin" ? "officer" : "admin"))}
          disabled={rolePending}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
        >
          {rolePending ? "…" : currentRole === "admin" ? "→ Officer" : "→ Admin"}
        </button>
      )}

      {/* Reset password */}
      {hasUsername && (
        <button
          onClick={() => setShowReset(true)}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
        >
          รีเซ็ต PW
        </button>
      )}

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReset(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl">
            <h3 className="section-title text-lg font-semibold">รีเซ็ตรหัสผ่าน</h3>

            {resetError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{resetError}</div>
            )}

            <form ref={formRef} action={resetAction} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={userId} />
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
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowReset(false)} className="rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white">
                  ยกเลิก
                </button>
                <button type="submit" disabled={resetPending} className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                  {resetPending ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
