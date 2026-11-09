import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { decryptThaiCidFromStorage } from "@/lib/auth";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";
import type { RowDataPacket } from "mysql2/promise";
import { AppIcon } from "@/app/_components/ui/icon";
import { PageHero } from "@/app/(main)/admin/_components/page-hero";
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
  /** SEC-04: 1 = ผู้ดูแลระบบอนุญาตให้ผูก ThaiD ครั้งแรกด้วยชื่อ-นามสกุล */
  thaid_link_enabled?: number | null;
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

  const BASE_COLUMNS = `id, thaid_cid, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, officer_position, email, username, role, facility_id, is_active, last_login_at`;
  /** SEC-04: `thaid_link_enabled` มีเฉพาะหลังรัน database/add_thaid_link_approval.sql */
  let thaidLinkColumnAvailable = true;

  try {
    const rows = await selectRows<UserRow>(
      `SELECT ${BASE_COLUMNS}, thaid_link_enabled
       FROM users ORDER BY role DESC, first_name ASC, last_name ASC`
    ).catch(async (error) => {
      thaidLinkColumnAvailable = false;
      if (!isMissingSchemaError(error)) throw error;
      return selectRows<UserRow>(
        `SELECT ${BASE_COLUMNS}
         FROM users ORDER BY role DESC, first_name ASC, last_name ASC`
      );
    });
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

      <PageHero
        icon="users"
        title="จัดการผู้ใช้งาน"
        description="อนุมัติผู้ลงทะเบียน กำหนดสิทธิ์ หน่วยงาน และเปิด/ปิดบัญชีผู้ใช้งาน"
        image="meeting-room"
        actions={
          <CreateUserModal facilities={facilities}>
            <button type="button" className="primary-action">
              <AppIcon name="plus" size={16} />
              เพิ่มผู้ใช้งาน
            </button>
          </CreateUserModal>
        }
      >
        <dl className="mt-4 flex flex-wrap gap-2 text-sm">
          <div className="flex items-baseline gap-1.5 rounded-lg border border-[var(--line)] bg-white/85 px-3 py-1.5">
            <dt className="text-[var(--muted)]">ผู้ใช้งาน</dt>
            <dd className="font-semibold tabular-nums">{systemUserCount.toLocaleString("th-TH")}</dd>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-lg border border-[var(--line)] bg-white/85 px-3 py-1.5">
            <dt className="text-[var(--muted)]">รออนุมัติ</dt>
            <dd className={`font-semibold tabular-nums ${pendingRegistrationCount > 0 ? "text-[var(--state-warning-fg)]" : ""}`}>{pendingRegistrationCount.toLocaleString("th-TH")}</dd>
          </div>
        </dl>
      </PageHero>

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
            typecode: facility.typecode,
          }))}
          currentUserId={Number(user.id)}
          thaidLinkColumnAvailable={thaidLinkColumnAvailable}
        />
      )}
    </div>
  );
}
