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
  PERMISSION_DEFINITIONS,
  type AppRole,
  type PermissionKey,
} from "@/lib/permission-definitions";

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
