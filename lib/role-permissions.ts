import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";

export type AppRole = "admin" | "officer" | "viewer";

export const PERMISSION_DEFINITIONS = [
  { key: "assets.view", label: "ดูรายการทรัพย์สิน", area: "Assets" },
  { key: "assets.create", label: "เพิ่มทรัพย์สิน", area: "Assets" },
  { key: "assets.update", label: "แก้ไขทรัพย์สิน", area: "Assets" },
  { key: "assets.delete", label: "ลบทรัพย์สิน", area: "Assets" },
  { key: "assets.network.view", label: "ดูข้อมูล IP/Network", area: "Assets" },
  { key: "transfer.manage", label: "โอนย้ายทรัพย์สิน", area: "Operations" },
  { key: "disposal.manage", label: "จำหน่าย/ชำรุด/สูญหาย", area: "Operations" },
  { key: "inspection.view", label: "ดูผลตรวจนับ", area: "Operations" },
  { key: "inspection.create", label: "สร้างรอบตรวจนับ", area: "Operations" },
  { key: "reports.view", label: "ดูรายงาน", area: "Reporting" },
  { key: "audit.view", label: "ดู Audit Log", area: "Security" },
  { key: "audit.export", label: "Export Audit Log", area: "Security" },
  { key: "users.manage", label: "จัดการผู้ใช้งาน", area: "Administration" },
  { key: "facilities.manage", label: "จัดการหน่วยงาน", area: "Administration" },
  { key: "device-types.manage", label: "จัดการประเภทอุปกรณ์", area: "Administration" },
  { key: "permissions.manage", label: "จัดการ Permission Matrix", area: "Administration" },
  { key: "agent.manage", label: "จัดการ Agent", area: "Administration" },
] as const;

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]["key"];

type Matrix = Record<AppRole, Record<PermissionKey, boolean>>;

const DEFAULT_MATRIX: Matrix = {
  admin: Object.fromEntries(PERMISSION_DEFINITIONS.map((permission) => [permission.key, true])) as Record<
    PermissionKey,
    boolean
  >,
  officer: {
    "assets.view": true,
    "assets.create": true,
    "assets.update": true,
    "assets.delete": true,
    "assets.network.view": true,
    "transfer.manage": true,
    "disposal.manage": true,
    "inspection.view": true,
    "inspection.create": true,
    "reports.view": true,
    "audit.view": false,
    "audit.export": false,
    "users.manage": false,
    "facilities.manage": false,
    "device-types.manage": false,
    "permissions.manage": false,
    "agent.manage": true,
  },
  viewer: {
    "assets.view": true,
    "assets.create": false,
    "assets.update": false,
    "assets.delete": false,
    "assets.network.view": false,
    "transfer.manage": false,
    "disposal.manage": false,
    "inspection.view": true,
    "inspection.create": false,
    "reports.view": true,
    "audit.view": false,
    "audit.export": false,
    "users.manage": false,
    "facilities.manage": false,
    "device-types.manage": false,
    "permissions.manage": false,
    "agent.manage": false,
  },
};

type RolePermissionRow = RowDataPacket & {
  role: AppRole;
  permission_key: PermissionKey;
  is_allowed: number;
};

function cloneDefaultMatrix(): Matrix {
  return {
    admin: { ...DEFAULT_MATRIX.admin },
    officer: { ...DEFAULT_MATRIX.officer },
    viewer: { ...DEFAULT_MATRIX.viewer },
  };
}

export async function getRolePermissionMatrix(): Promise<Matrix> {
  const matrix = cloneDefaultMatrix();

  try {
    const rows = await selectRows<RolePermissionRow>(
      `SELECT role, permission_key, is_allowed
       FROM role_permissions`
    );

    for (const row of rows) {
      if (!matrix[row.role]) continue;
      if (!(row.permission_key in matrix[row.role])) continue;
      matrix[row.role][row.permission_key] = Boolean(row.is_allowed);
    }
  } catch {
    return matrix;
  }

  return matrix;
}

export async function hasPermission(role: AppRole, permission: PermissionKey): Promise<boolean> {
  const matrix = await getRolePermissionMatrix();
  return Boolean(matrix[role]?.[permission]);
}

export async function listGrantedPermissions(role: AppRole): Promise<PermissionKey[]> {
  const matrix = await getRolePermissionMatrix();
  return PERMISSION_DEFINITIONS.map((permission) => permission.key).filter((permission) => matrix[role][permission]);
}

export async function upsertRolePermission(input: {
  role: AppRole;
  permission: PermissionKey;
  isAllowed: boolean;
  updatedBy?: string;
}) {
  await executeStatement(
    `INSERT INTO role_permissions (role, permission_key, is_allowed, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_allowed = VALUES(is_allowed),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
    [input.role, input.permission, input.isAllowed ? 1 : 0, input.updatedBy ?? null]
  );
}

export const APP_ROLES: AppRole[] = ["admin", "officer", "viewer"];