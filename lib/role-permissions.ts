import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";
export {
  APP_ROLES,
  PERMISSION_DEFINITIONS,
  type AppRole,
  type PermissionKey,
} from "@/lib/permission-definitions";
import {
  APP_ROLES,
  PERMISSION_DEFINITIONS,
  type AppRole,
  type PermissionKey,
} from "@/lib/permission-definitions";

/** B13: the role/permission pair must be one the app defines, never an arbitrary form value. */
export function isValidRolePermission(role: unknown, permission: unknown): boolean {
  if (typeof role !== "string" || typeof permission !== "string") return false;
  return (APP_ROLES as string[]).includes(role) && PERMISSION_DEFINITIONS.some((definition) => definition.key === permission);
}

/**
 * B12: why a role change must be refused, or null when it is allowed.
 * An admin may not change their own role, and the last active admin may not be demoted
 * (otherwise nobody could manage users or permissions any more).
 */
export function roleChangeBlockReason(input: {
  actorId: number | string;
  targetId: number | string;
  currentRole: string | null | undefined;
  newRole: string;
  /** Active admins other than the target. */
  otherActiveAdmins: number;
}): string | null {
  if (input.currentRole === input.newRole) return null;
  if (Number(input.actorId) === Number(input.targetId)) return "ไม่สามารถเปลี่ยนบทบาทของบัญชีตนเองได้";
  if (input.currentRole === "admin" && input.newRole !== "admin" && input.otherActiveAdmins < 1) {
    return "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน ไม่สามารถลดบทบาทผู้ดูแลระบบคนสุดท้ายได้";
  }
  return null;
}

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
    "disposal.approve": false,
    "repairs.view": true,
    "repairs.manage": true,
    "loans.view": true,
    "loans.manage": true,
    "inspection.view": true,
    "inspection.create": true,
    "reports.view": true,
    "audit.view": false,
    "audit.export": false,
    "users.manage": false,
    "facilities.manage": false,
    "device-types.manage": false,
    "work-groups.manage": true,
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
    "disposal.approve": false,
    "repairs.view": true,
    "repairs.manage": false,
    "loans.view": true,
    "loans.manage": false,
    "inspection.view": true,
    "inspection.create": false,
    "reports.view": true,
    "audit.view": false,
    "audit.export": false,
    "users.manage": false,
    "facilities.manage": false,
    "device-types.manage": false,
    "work-groups.manage": false,
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
  if (!isValidRolePermission(input.role, input.permission)) throw new Error("Role หรือสิทธิ์ไม่ถูกต้อง");
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
