"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { setThaidLinkEnabledAction, toggleUserActiveAction, resetUserPasswordAction, updateUserProfileAction } from "@/app/(main)/admin/users/actions";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
};

type Props = {
  userId: number;
  fullName: string;
  officerPosition: string | null;
  email: string | null;
  username: string | null;
  thaidCid: string | null;
  currentFacilityId: number | null;
  facilities: FacilityOption[];
  currentActive: boolean;
  currentRole: "admin" | "officer" | "viewer";
  hasUsername: boolean;
  isSelf: boolean;
  /** SEC-04: บัญชีนี้ได้รับอนุญาตให้ผูก ThaiD ครั้งแรกด้วยชื่อ-นามสกุลหรือยัง */
  thaidLinkEnabled?: boolean;
  /** SEC-04: false เมื่อยังไม่ได้รัน database/add_thaid_link_approval.sql */
  thaidLinkColumnAvailable?: boolean;
};

export function UserRowActions({
  userId,
  fullName,
  officerPosition,
  email,
  username,
  thaidCid,
  currentFacilityId,
  facilities,
  currentActive,
  currentRole,
  hasUsername,
  isSelf,
  thaidLinkEnabled = false,
  thaidLinkColumnAvailable = false,
}: Props) {
  const mounted = typeof document !== "undefined";
  const [showActions, setShowActions] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [linkPending, startLink] = useTransition();
  const [linkError, setLinkError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!showActions && !showEdit && !showReset) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setShowActions(false);
      setShowEdit(false);
      setShowReset(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showActions, showEdit, showReset]);

  const [editError, editAction, editPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const nextRole = String(fd.get("role") ?? currentRole);
      if (nextRole !== currentRole && !window.confirm(`ยืนยันเปลี่ยนสิทธิ์ของ ${fullName} จาก ${currentRole} เป็น ${nextRole}?`)) {
        return "ยกเลิกการเปลี่ยนสิทธิ์แล้ว";
      }
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
    <div className="inline-flex items-center">
      <ActionIconButton
        icon="settings"
        label={`จัดการผู้ใช้ ${fullName}`}
        onClick={() => setShowActions(true)}
        className="rounded-xl"
      />

      {mounted && showActions && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" role="presentation">
          <button type="button" aria-label="ปิดเมนูจัดการ" className="absolute inset-0 bg-black/40" onClick={() => setShowActions(false)} />
          <section role="dialog" aria-modal="true" aria-labelledby={`manage-user-${userId}`} className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`manage-user-${userId}`} className="text-lg font-semibold">จัดการผู้ใช้งาน</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{fullName}</p>
              </div>
              <button type="button" onClick={() => setShowActions(false)} aria-label="ปิด" className="min-h-11 min-w-11 rounded-xl text-stone-500 hover:bg-stone-100">✕</button>
            </div>
            <div className="mt-5 grid gap-2">
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => {
                    setEditRole(currentRole);
                    setEditFacilityId(currentFacilityId?.toString() ?? "");
                    setShowActions(false);
                    setShowEdit(true);
                  }}
                  className="min-h-11 rounded-xl border border-stone-200 px-4 py-2 text-left text-sm font-semibold hover:bg-stone-50"
                >
                  แก้ไขข้อมูลและสิทธิ์
                </button>
              )}
              {hasUsername && (
                <button
                  type="button"
                  onClick={() => { setShowActions(false); setShowReset(true); }}
                  className="min-h-11 rounded-xl border border-stone-200 px-4 py-2 text-left text-sm font-semibold hover:bg-stone-50"
                >
                  รีเซ็ตรหัสผ่าน
                </button>
              )}
              {!isSelf && currentRole !== "admin" && !thaidCid && thaidLinkColumnAvailable && (
                <button
                  type="button"
                  disabled={linkPending}
                  onClick={() => {
                    const next = !thaidLinkEnabled;
                    const label = next ? "อนุญาต" : "ยกเลิกการอนุญาต";
                    if (!window.confirm(`ยืนยัน${label}ให้บัญชี ${fullName} ผูกบัญชี ThaiD ด้วยชื่อ-นามสกุล?`)) return;
                    setLinkError(null);
                    startLink(async () => {
                      const error = await setThaidLinkEnabledAction(userId, next);
                      if (error) { setLinkError(error); return; }
                      setShowActions(false);
                    });
                  }}
                  className="min-h-11 rounded-xl border border-stone-200 px-4 py-2 text-left text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
                >
                  {linkPending
                    ? "กำลังบันทึก..."
                    : thaidLinkEnabled
                      ? "ปิดสิทธิ์เชื่อมต่อ ThaiD ครั้งแรก"
                      : "อนุญาตให้เชื่อมต่อ ThaiD ครั้งแรก"}
                </button>
              )}
              {linkError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{linkError}</p>}
              {!isSelf && (
                <button
                  type="button"
                  disabled={togglePending}
                  onClick={() => {
                    const nextAction = currentActive ? "ปิดใช้งาน" : "เปิดใช้งาน";
                    if (!window.confirm(`ยืนยัน${nextAction}บัญชี ${fullName}?`)) return;
                    startToggle(async () => {
                      await toggleUserActiveAction(userId, currentActive);
                      setShowActions(false);
                    });
                  }}
                  className={`min-h-11 rounded-xl border px-4 py-2 text-left text-sm font-semibold disabled:opacity-50 ${
                    currentActive ? "border-rose-200 text-rose-800 hover:bg-rose-50" : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  {togglePending ? "กำลังบันทึก..." : currentActive ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี"}
                </button>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}

      {/* Reset password modal */}
      {mounted && showReset && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReset(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby={`reset-password-${userId}`} className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 id={`reset-password-${userId}`} className="text-lg font-semibold">รีเซ็ตรหัสผ่าน</h3>

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
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby={`edit-user-${userId}`} className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 id={`edit-user-${userId}`} className="text-lg font-semibold">แก้ไขข้อมูลผู้ใช้</h3>

            {editError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</div>
            )}

            <form ref={editFormRef} action={editAction} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <div>
                <label className="block text-sm font-medium">ชื่อ-นามสกุล</label>
                <input name="fullName" required defaultValue={fullName} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </div>
              {editRole === "officer" && (
                <div>
                  <label className="block text-sm font-medium">ตำแหน่งเจ้าหน้าที่</label>
                  <input name="officerPosition" required maxLength={150} defaultValue={officerPosition ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </div>
              )}
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
                    <option value="officer">เจ้าหน้าที่</option>
                    <option value="admin">ผู้ดูแลระบบ</option>
                    <option value="viewer">ผู้ดูข้อมูล</option>
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
