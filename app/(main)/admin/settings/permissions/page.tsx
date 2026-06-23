import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import {
  APP_ROLES,
  PERMISSION_DEFINITIONS,
  getRolePermissionMatrix,
  hasPermission,
  type AppRole,
  type PermissionKey,
} from "@/lib/role-permissions";
import { PermissionsMatrixClient } from "./_components/permissions-matrix-client";

export const dynamic = "force-dynamic";

type UserPermissionRow = RowDataPacket & {
  id: number;
  full_name: string;
  role: AppRole;
  is_active: number;
};

export default async function AdminPermissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowManageByPolicy = user.role === "admin" || (await hasPermission(user.role, "permissions.manage"));
  if (!allowManageByPolicy) redirect("/");

  const matrix = await getRolePermissionMatrix();
  const users = await selectRows<UserPermissionRow>(
    `SELECT id, full_name, role, is_active
     FROM users
     ORDER BY role DESC, full_name ASC`
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/admin/settings" className="hover:underline">ตั้งค่าระบบ</Link>
        <span>›</span>
        <span>Permission Matrix</span>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · Security</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">จัดการ Permission Matrix</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ปรับสิทธิ์รายบทบาทแบบละเอียด โดยไม่ต้องยึดค่าตายตัวตาม role เดิม
        </p>
        <div className="mt-3">
          <a
            href="/api/export/permissions"
            className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Export Policy JSON
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {APP_ROLES.map((role) => {
          const allowCount = Object.values(matrix[role]).filter(Boolean).length;
          return (
            <div key={role} className="glass-panel rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">{role}</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{allowCount}</p>
              <p className="text-xs text-[var(--muted)]">สิทธิ์ที่อนุญาต</p>
            </div>
          );
        })}
      </div>

      <PermissionsMatrixClient
        definitions={PERMISSION_DEFINITIONS.map((definition) => ({
          key: definition.key as PermissionKey,
          label: definition.label,
          area: definition.area,
        }))}
        matrix={matrix as Record<AppRole, Record<PermissionKey, boolean>>}
      />

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-black/6 px-5 py-4">
          <h2 className="text-lg font-semibold">Effective Permissions by User</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            แสดงสิทธิ์ตามบทบาทปัจจุบันของผู้ใช้แต่ละบัญชี เพื่อช่วยตรวจสอบผลกระทบก่อนเปลี่ยนนโยบาย
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/6 bg-stone-50/70 text-xs text-[var(--muted)]">
                <th className="px-4 py-3 text-left font-medium">ผู้ใช้</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                <th className="px-4 py-3 text-left font-medium">Allowed</th>
                <th className="px-4 py-3 text-left font-medium">สิทธิ์สำคัญ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {users.map((account) => {
                const granted = PERMISSION_DEFINITIONS.filter((permission) =>
                  matrix[account.role][permission.key]
                );
                return (
                  <tr key={account.id} className="transition hover:bg-white/50">
                    <td className="px-4 py-3 font-medium">{account.full_name}</td>
                    <td className="px-4 py-3">
	                      <StatusBadge tone="info">
	                        {account.role}
	                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {account.is_active ? (
	                        <StatusBadge tone={activeTone(!!account.is_active)}>active</StatusBadge>
	                      ) : (
	                        <StatusBadge tone={activeTone(!!account.is_active)}>inactive</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                      {granted.length} / {PERMISSION_DEFINITIONS.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {granted.slice(0, 4).map((permission) => (
                          <span
                            key={permission.key}
                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                          >
                            {permission.key}
                          </span>
                        ))}
                        {granted.length > 4 && (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                            +{granted.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
