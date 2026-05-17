import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";
import { approveUserAction } from "./actions";
import { CreateUserModal } from "./_components/create-user-modal";
import { UserRowActions } from "./_components/user-row-actions";

type UserRow = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  email: string | null;
  username: string | null;
  role: "admin" | "officer" | "viewer";
  facility_id: number | null;
  is_active: number;
  last_login_at: Date | string | null;
};

type UserRowWithoutFacility = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  email: string | null;
  username: string | null;
  role: "admin" | "officer" | "viewer";
  is_active: number;
  last_login_at: Date | string | null;
};

function formatDate(v: Date | string | null) {
  if (!v) return "–";
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 16).replace("T", " ");
}

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const facilities = await listAllFacilitiesForSelect();
  const facilityNameById = new Map(
    facilities.map((f) => [f.id, `${f.facility_name}${f.district_name ? ` · อ.${f.district_name}` : ""}`])
  );
  let users: UserRow[] = [];
  let dbError = false;

  try {
    users = await selectRows<UserRow>(
      `SELECT id, thaid_cid, full_name, email, username, role, facility_id, is_active, last_login_at
       FROM users ORDER BY role DESC, full_name ASC`
    );
  } catch {
    try {
      const fallback = await selectRows<UserRowWithoutFacility>(
        `SELECT id, thaid_cid, full_name, email, username, role, is_active, last_login_at
         FROM users ORDER BY role DESC, full_name ASC`
      );
      users = fallback.map((row) => ({ ...row, facility_id: null }));
    } catch {
      dbError = true;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · จัดการผู้ใช้งาน</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">ผู้ใช้งานระบบ</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{users.length} บัญชีผู้ใช้งาน</p>
        </div>
        <CreateUserModal facilities={facilities}>
          <button className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
            + เพิ่มผู้ใช้งาน
          </button>
        </CreateUserModal>
      </div>

      {dbError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          ไม่สามารถเชื่อมต่อฐานข้อมูลได้ — กรุณาตรวจสอบการตั้งค่า MYSQL_*
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                <th className="px-4 py-3 text-left font-medium">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3 text-left font-medium">Username / ThaiD</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">หน่วยงาน</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                <th className="px-4 py-3 text-left font-medium">เข้าใช้งานล่าสุด</th>
                <th className="px-4 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {users.map((u) => (
                <tr key={u.id} className="transition hover:bg-white/50">
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {u.username && <p>@{u.username}</p>}
                    {u.thaid_cid && <p className="text-[10px]">ThaiD: {u.thaid_cid}</p>}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{u.email ?? "–"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {u.role === "officer"
                      ? u.facility_id
                        ? facilityNameById.get(u.facility_id) ?? `หน่วยงาน #${u.facility_id}`
                        : "ยังไม่ระบุ"
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        u.role === "admin" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">ใช้งานอยู่</span>
                    ) : !u.last_login_at ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">รออนุมัติ</span>
                        <form action={approveUserAction.bind(null, u.id)}>
                          <button type="submit" className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold text-white hover:opacity-80">อนุมัติ</button>
                        </form>
                      </div>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-600">ปิดใช้งาน</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{formatDate(u.last_login_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <UserRowActions
                      userId={u.id}
                      fullName={u.full_name}
                      email={u.email}
                      username={u.username}
                      thaidCid={u.thaid_cid}
                      currentFacilityId={u.facility_id}
                      facilities={facilities.map((f) => ({ id: f.id, facility_name: f.facility_name, district_name: f.district_name }))}
                      currentActive={!!u.is_active}
                      currentRole={u.role}
                      hasUsername={!!u.username}
                      isSelf={u.id === Number(user.id)}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 && !dbError && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">
                    ไม่พบผู้ใช้งาน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
