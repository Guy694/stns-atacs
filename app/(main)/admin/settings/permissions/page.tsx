import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import {
  APP_ROLES,
  PERMISSION_DEFINITIONS,
  getRolePermissionMatrix,
  type AppRole,
  type PermissionKey,
} from "@/lib/role-permissions";
import { PermissionsMatrixClient } from "./_components/permissions-matrix-client";
import { withBasePath } from "@/lib/base-path";
import { roleLabel } from "@/lib/app-brand";
import { AppIcon } from "@/app/_components/ui/icon";
import { PageHero, SettingsBreadcrumb, SummaryCard } from "@/app/(main)/admin/_components/page-hero";
import { EffectivePermissionsTable } from "./_components/effective-permissions-table";

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

  if (user.role !== "admin") redirect("/dashboard");

  const matrix = await getRolePermissionMatrix();
  const users = await selectRows<UserPermissionRow>(
     `SELECT id, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, role, is_active
     FROM users
      ORDER BY role DESC, first_name ASC, last_name ASC`
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <SettingsBreadcrumb current="ตารางสิทธิ์" />
      <PageHero
        icon="shield"
        image="meeting-room"
        title="จัดการตารางสิทธิ์การใช้งาน"
        description="ปรับสิทธิ์รายบทบาทแบบละเอียด โดยไม่ต้องยึดค่าตายตัวตาม role เดิม"
        actions={
          <a href={withBasePath("/api/export/permissions/")} className="secondary-action gap-2">
            <AppIcon name="download" size={16} /> ส่งออกนโยบายสิทธิ์ (JSON)
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {APP_ROLES.map((role) => {
          const allowCount = Object.values(matrix[role]).filter(Boolean).length;
          return (
            <SummaryCard
              key={role}
              icon={role === "admin" ? "shield" : role === "officer" ? "user" : "eye"}
              image={role === "admin" ? "it-storage" : role === "officer" ? "office-desk" : "meeting-room"}
              label={roleLabel(role)}
              value={`${allowCount.toLocaleString("th-TH")} / ${PERMISSION_DEFINITIONS.length.toLocaleString("th-TH")}`}
              hint="สิทธิ์ที่อนุญาต"
            />
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

      <EffectivePermissionsTable
        total={PERMISSION_DEFINITIONS.length}
        users={users.map((account) => ({
          id: account.id,
          fullName: account.full_name,
          role: account.role,
          isActive: !!account.is_active,
          granted: PERMISSION_DEFINITIONS.filter((permission) => matrix[account.role][permission.key]).map((permission) => permission.key),
        }))}
      />
    </div>
  );
}
