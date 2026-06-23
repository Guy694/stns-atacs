"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createUserAction } from "@/app/(main)/admin/users/actions";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
  typecode: string;
};

type Props = { children: React.ReactNode; facilities: FacilityOption[] };

export function CreateUserModal({ children, facilities }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const facilityRef = useRef<HTMLSelectElement>(null);
  const [role, setRole] = useState<"admin" | "officer" | "viewer">("officer");
  const [facilityId, setFacilityId] = useState("");

  function handleRoleChange(nextRole: "admin" | "officer" | "viewer") {
    setRole(nextRole);
    if (nextRole !== "officer") {
      setFacilityId("");
    }
  }

  useEffect(() => {
    if (open && role === "officer") {
      facilityRef.current?.focus();
    }
  }, [open, role]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await createUserAction(prev, fd);
      if (!result) {
        setOpen(false);
        formRef.current?.reset();
        setRole("officer");
        setFacilityId("");
      }
      return result;
    },
    null
  );

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="create-user-heading" className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-center justify-between">
              <h2 id="create-user-heading" className="text-xl font-semibold">เพิ่มผู้ใช้งานใหม่</h2>
              <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-xl text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)]">✕</button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            <form ref={formRef} action={formAction} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
                <input name="fullName" required placeholder="เช่น นายสมชาย ใจดี" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </div>

              <div>
                <label className="block text-sm font-medium">Email</label>
                <input name="email" type="email" placeholder="example@moph.go.th" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </div>

              <div className="rounded-xl border border-black/8 bg-stone-50/60 p-4 space-y-3">
                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">วิธีเข้าสู่ระบบ (อย่างน้อย 1 วิธี)</p>
                <div>
                  <label className="block text-sm font-medium">ThaiD (เลขบัตรประชาชน 13 หลัก)</label>
                  <input name="thaidCid" placeholder="XXXXXXXXXXXXX" maxLength={13} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Username</label>
                    <input name="username" placeholder="เช่น somchai.j" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">รหัสผ่าน</label>
                    <input name="password" type="password" placeholder="≥ 8 ตัวอักษร" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Role</label>
                <select
                  name="role"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as "admin" | "officer" | "viewer")}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="officer">Officer — เจ้าหน้าที่</option>
                  <option value="admin">Admin — ผู้ดูแลระบบ</option>
                  <option value="viewer">Viewer — ดูข้อมูลเท่านั้น</option>
                </select>
              </div>

              {role === "officer" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium">ตำแหน่งเจ้าหน้าที่</label>
                    <input name="officerPosition" required maxLength={150} placeholder="เช่น นักวิชาการคอมพิวเตอร์" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">หน่วยงานของเจ้าหน้าที่</label>
                  <select
                    ref={facilityRef}
                    name="facilityId"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
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
                  <p className="mt-1 text-xs text-[var(--muted)]">ใช้สำหรับกำหนดว่าเจ้าหน้าที่จะจัดการข้อมูลของหน่วยงานใด (จำเป็น)</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Role นี้ไม่ต้องกำหนดหน่วยงาน
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-black/10 bg-white/80 px-5 py-2 text-sm font-medium hover:bg-white">
                  ยกเลิก
                </button>
                <button type="submit" disabled={pending || (role === "officer" && !facilityId)} className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                  {pending ? "กำลังบันทึก…" : "เพิ่มผู้ใช้งาน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
