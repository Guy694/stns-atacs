import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { decryptThaiCidFromStorage } from "@/lib/auth";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";
import { CreateUserModal } from "./_components/create-user-modal";
import { UsersManagementClient } from "./_components/users-management-client";

type UserRow = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  officer_position: string | null;
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
  officer_position: string | null;
  email: string | null;
  username: string | null;
  role: "admin" | "officer" | "viewer";
  is_active: number;
  last_login_at: Date | string | null;
};

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const facilities = await listAllFacilitiesForSelect();
  let users: UserRow[] = [];
  let dbError = false;

  try {
    const rows = await selectRows<UserRow>(
      `SELECT id, thaid_cid, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, officer_position, email, username, role, facility_id, is_active, last_login_at
       FROM users ORDER BY role DESC, first_name ASC, last_name ASC`
    );
    users = rows.map((row) => ({ ...row, thaid_cid: decryptThaiCidFromStorage(row.thaid_cid) }));
  } catch {
    try {
      const fallback = await selectRows<UserRowWithoutFacility>(
        `SELECT id, thaid_cid, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, NULL AS officer_position, email, username, role, is_active, last_login_at
         FROM users ORDER BY role DESC, first_name ASC, last_name ASC`
      );
      users = fallback.map((row) => ({ ...row, thaid_cid: decryptThaiCidFromStorage(row.thaid_cid), facility_id: null }));
    } catch {
      dbError = true;
    }
  }

  const pendingRegistrationCount = users.filter((listedUser) => !listedUser.is_active && !listedUser.last_login_at).length;
  const systemUserCount = users.length - pendingRegistrationCount;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent-strong)]">ระบบและความปลอดภัย</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">จัดการผู้ใช้งาน</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {systemUserCount} ผู้ใช้งาน · {pendingRegistrationCount} รายการรออนุมัติ
          </p>
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

      {!dbError && (
        <UsersManagementClient
          users={users}
          facilities={facilities.map((facility) => ({
            id: facility.id,
            facility_name: facility.facility_name,
            district_name: facility.district_name,
          }))}
          currentUserId={Number(user.id)}
        />
      )}
    </div>
  );
}
