"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toggleUserActiveAction, updateUserRoleAction, resetUserPasswordAction, updateUserProfileAction } from "@/app/(main)/admin/users/actions";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
};

type Props = {
  userId: number;
  fullName: string;
  email: string | null;
  username: string | null;
  thaidCid: string | null;
  currentFacilityId: number | null;
  facilities: FacilityOption[];
  currentActive: boolean;
  currentRole: "admin" | "officer" | "viewer";
  hasUsername: boolean;
  isSelf: boolean;
};

export function UserRowActions({
  userId,
  fullName,
  email,
  username,
  thaidCid,
  currentFacilityId,
  facilities,
  currentActive,
  currentRole,
  hasUsername,
  isSelf,
}: Props) {
  const mounted = typeof document !== "undefined";
  const [showEdit, setShowEdit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [rolePending, startRole] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const editFacilityRef = useRef<HTMLSelectElement>(null);
  const [editRole, setEditRole] = useState<"admin" | "officer" | "viewer">(currentRole);
  const [editFacilityId, setEditFacilityId] = useState(currentFacilityId?.toString() ?? "");

  function handleEditRoleChange(nextRole: "admin" | "officer" | "viewer") {
    setEditRole(nextRole);
    if (nextRole !== "officer") {
      setEditFacilityId("");
    }
  }

  useEffect(() => {
    if (showEdit && editRole === "officer") {
      editFacilityRef.current?.focus();
    }
  }, [showEdit, editRole]);

  const [editError, editAction, editPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const res = await updateUserProfileAction(prev, fd);
      if (!res) setShowEdit(false);
      return res;
    },
    null
  );

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
      {!isSelf && (
        <button
          onClick={() => {
            setEditRole(currentRole);
            setEditFacilityId(currentFacilityId?.toString() ?? "");
            setShowEdit(true);
          }}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
        >
          แก้ไขข้อมูล
        </button>
      )}

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
          onClick={() => startRole(() => updateUserRoleAction(userId, currentRole === "admin" ? "officer" : currentRole === "officer" ? "viewer" : "admin"))}
          disabled={rolePending}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
        >
          {rolePending ? "…" : currentRole === "admin" ? "→ Officer" : currentRole === "officer" ? "→ Viewer" : "→ Admin"}
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
      {mounted && showReset && createPortal(
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
        </div>,
        document.body
      )}

      {mounted && showEdit && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl">
            <h3 className="section-title text-lg font-semibold">แก้ไขข้อมูลผู้ใช้</h3>

            {editError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</div>
            )}

            <form ref={editFormRef} action={editAction} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <div>
                <label className="block text-sm font-medium">ชื่อ-นามสกุล</label>
                <input name="fullName" required defaultValue={fullName} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input name="email" type="email" defaultValue={email ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Role</label>
                  <select
                    name="role"
                    value={editRole}
                    onChange={(e) => handleEditRoleChange(e.target.value as "admin" | "officer" | "viewer")}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="officer">Officer</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Username</label>
                  <input name="username" defaultValue={username ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium">ThaiD CID</label>
                  <input name="thaidCid" defaultValue={thaidCid ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              {editRole === "officer" ? (
                <div>
                  <label className="block text-sm font-medium">หน่วยงาน (สำหรับ Officer)</label>
                  <select
                    ref={editFacilityRef}
                    name="facilityId"
                    value={editFacilityId}
                    onChange={(e) => setEditFacilityId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">— เลือกหน่วยงาน —</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.facility_name} {f.district_name ? `· อ.${f.district_name}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--muted)]">Officer ต้องเลือกหน่วยงาน</p>
                </div>
              ) : (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Role นี้ไม่ต้องกำหนดหน่วยงาน
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowEdit(false)} className="rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white">
                  ยกเลิก
                </button>
                <button type="submit" disabled={editPending || (editRole === "officer" && !editFacilityId)} className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                  {editPending ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
