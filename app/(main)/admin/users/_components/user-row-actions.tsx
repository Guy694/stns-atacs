"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, useId } from "react";
import { createPortal } from "react-dom";
import { setThaidLinkEnabledAction, toggleUserActiveAction, resetUserPasswordAction, updateUserProfileAction } from "@/app/(main)/admin/users/actions";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { submitWithoutReset } from "@/app/_components/ui/submit-without-reset";
import { confirmAction } from "@/app/_components/ui/confirm";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
  typecode?: string | null;
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
  const fieldId = useId();
  const mounted = typeof document !== "undefined";
  const [showEdit, setShowEdit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [linkPending, startLink] = useTransition();
  const [linkError, setLinkError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const facilityOptions = useMemo(() => facilities.map((f) => ({ id: f.id, name: f.facility_name, typecode: f.typecode, districtName: f.district_name })), [facilities]);
  const [editRole, setEditRole] = useState<"admin" | "officer" | "viewer">(currentRole);
  const [editFacilityId, setEditFacilityId] = useState(currentFacilityId?.toString() ?? "");

  function handleEditRoleChange(nextRole: "admin" | "officer" | "viewer") {
    setEditRole(nextRole);
    if (nextRole !== "officer") {
      setEditFacilityId("");
    }
  }

  useEffect(() => {
    if (!showEdit && !showReset) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setShowEdit(false);
      setShowReset(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showEdit, showReset]);

  const [editError, editAction, editPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const nextRole = String(fd.get("role") ?? currentRole);
      if (nextRole !== currentRole && !(await confirmAction({ title: "เปลี่ยนสิทธิ์ผู้ใช้?", text: `${fullName}: ${currentRole} → ${nextRole}`, confirmText: "เปลี่ยนสิทธิ์" }))) {
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

  async function toggleThaidLink() {
    const next = !thaidLinkEnabled;
    const label = next ? "อนุญาต" : "ยกเลิกการอนุญาต";
    if (!(await confirmAction({ title: `${label}เชื่อมต่อ ThaiD?`, text: `บัญชี ${fullName} ผูกบัญชี ThaiD ด้วยชื่อ-นามสกุล`, confirmText: label }))) return;
    setLinkError(null);
    startLink(async () => {
      const error = await setThaidLinkEnabledAction(userId, next);
      if (error) setLinkError(error);
    });
  }

  async function toggleActive() {
    const nextAction = currentActive ? "ปิดใช้งาน" : "เปิดใช้งาน";
    if (!(await confirmAction({ title: `${nextAction}บัญชี?`, text: fullName, confirmText: nextAction, danger: currentActive }))) return;
    startToggle(async () => {
      await toggleUserActiveAction(userId, currentActive);
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-1.5">
        {!isSelf && (
          <ActionIconButton
            icon="pencil"
            label={`แก้ไขข้อมูลและสิทธิ์ ${fullName}`}
            onClick={() => {
              setEditRole(currentRole);
              setEditFacilityId(currentFacilityId?.toString() ?? "");
              setShowEdit(true);
            }}
          />
        )}
        {hasUsername && (
          <ActionIconButton icon="key" label={`รีเซ็ตรหัสผ่าน ${fullName}`} onClick={() => setShowReset(true)} />
        )}
        {!isSelf && currentRole !== "admin" && !thaidCid && thaidLinkColumnAvailable && (
          <ActionIconButton
            icon="shield"
            tone={thaidLinkEnabled ? "primary" : "neutral"}
            aria-pressed={thaidLinkEnabled}
            aria-busy={linkPending}
            disabled={linkPending}
            label={thaidLinkEnabled ? `ปิดสิทธิ์เชื่อมต่อ ThaiD ครั้งแรก ${fullName}` : `อนุญาตให้เชื่อมต่อ ThaiD ครั้งแรก ${fullName}`}
            onClick={toggleThaidLink}
          />
        )}
        {!isSelf && (
          <ActionIconButton
            icon={currentActive ? "power-off" : "power-on"}
            tone={currentActive ? "danger" : "primary"}
            aria-busy={togglePending}
            disabled={togglePending}
            label={currentActive ? `ปิดใช้งานบัญชี ${fullName}` : `เปิดใช้งานบัญชี ${fullName}`}
            onClick={toggleActive}
          />
        )}
        {isSelf && !hasUsername && <span className="text-xs text-[var(--muted)]">บัญชีของคุณ</span>}
      </div>
      {linkError && <p role="alert" className="max-w-56 rounded-lg bg-rose-50 px-2 py-1 text-left text-xs text-rose-700">{linkError}</p>}

      {/* Reset password modal */}
      {mounted && showReset && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReset(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby={`reset-password-${userId}`} className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`reset-password-${userId}`} className="text-lg font-semibold">รีเซ็ตรหัสผ่าน</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{fullName}</p>
              </div>
              <ActionIconButton icon="close" label="ปิด" onClick={() => setShowReset(false)} className="-mr-2 -mt-2 border-transparent bg-transparent" />
            </div>

            {resetError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{resetError}</div>
            )}

            <form ref={formRef} onSubmit={submitWithoutReset(resetAction)} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <div>
                <label htmlFor={`${fieldId}-newPassword`} className="block text-sm font-medium">รหัสผ่านใหม่ (≥ 8 ตัวอักษร)</label>
                <input id={`${fieldId}-newPassword`}
                  name="newPassword"
                  type="password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowReset(false)} className="secondary-action">
                  ยกเลิก
                </button>
                <button type="submit" disabled={resetPending} className="primary-action">
                  <AppIcon name="check" size={16} />
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
            <div className="flex items-start justify-between gap-3">
              <h3 id={`edit-user-${userId}`} className="text-lg font-semibold">แก้ไขข้อมูลผู้ใช้</h3>
              <ActionIconButton icon="close" label="ปิด" onClick={() => setShowEdit(false)} className="-mr-2 -mt-2 border-transparent bg-transparent" />
            </div>

            {editError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</div>
            )}

            <form ref={editFormRef} onSubmit={submitWithoutReset(editAction)} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <div>
                <label htmlFor={`${fieldId}-fullName`} className="block text-sm font-medium">ชื่อ-นามสกุล</label>
                <input id={`${fieldId}-fullName`} name="fullName" required defaultValue={fullName} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </div>
              {editRole === "officer" && (
                <div>
                  <label htmlFor={`${fieldId}-officerPosition`} className="block text-sm font-medium">ตำแหน่งเจ้าหน้าที่</label>
                  <input id={`${fieldId}-officerPosition`} name="officerPosition" required maxLength={150} defaultValue={officerPosition ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${fieldId}-email`} className="block text-sm font-medium">Email</label>
                  <input id={`${fieldId}-email`} name="email" type="email" defaultValue={email ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-role`} className="block text-sm font-medium">Role</label>
                  <select id={`${fieldId}-role`}
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
                  <label htmlFor={`${fieldId}-username`} className="block text-sm font-medium">ชื่อผู้ใช้ (Username)</label>
                  <input id={`${fieldId}-username`} name="username" defaultValue={username ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-thaidCid`} className="block text-sm font-medium">ThaiD CID</label>
                  <input id={`${fieldId}-thaidCid`} name="thaidCid" defaultValue={thaidCid ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              {editRole === "officer" ? (
                <div>
                  <label htmlFor={`${fieldId}-facilityId`} className="block text-sm font-medium">หน่วยงาน (สำหรับ Officer)</label>
                  <FacilitySelect
                    id={`${fieldId}-facilityId`}
                    name="facilityId"
                    facilities={facilityOptions}
                    value={editFacilityId}
                    onChange={setEditFacilityId}
                    required
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-[var(--muted)]">Officer ต้องเลือกหน่วยงาน</p>
                </div>
              ) : (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Role นี้ไม่ต้องกำหนดหน่วยงาน
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowEdit(false)} className="secondary-action">
                  ยกเลิก
                </button>
                <button type="submit" disabled={editPending || (editRole === "officer" && !editFacilityId)} className="primary-action">
                  <AppIcon name="check" size={16} />
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
