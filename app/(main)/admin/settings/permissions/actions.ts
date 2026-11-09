"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { type AppRole, type PermissionKey, isValidRolePermission, upsertRolePermission } from "@/lib/role-permissions";
import { userFacingError } from "@/lib/schema-errors";

async function requirePermissionManager() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export async function updateRolePermissionAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const actor = await requirePermissionManager();

  const roleInput = String(formData.get("role") ?? "");
  const permissionInput = String(formData.get("permission") ?? "");
  const isAllowed = String(formData.get("isAllowed") ?? "") === "1";

  // B13: only roles in APP_ROLES and keys in PERMISSION_DEFINITIONS may be written.
  if (!isValidRolePermission(roleInput, permissionInput)) {
    return "Role หรือสิทธิ์ไม่ถูกต้อง";
  }
  const role = roleInput as AppRole;
  const permission = permissionInput as PermissionKey;

  try {
    await upsertRolePermission({
      role,
      permission,
      isAllowed,
      updatedBy: actor.fullName,
    });

    await writeAuditLog({
      userId: actor.id,
      userName: actor.fullName,
      action: "update",
      entity: "role_permissions",
      summary: `ปรับสิทธิ์ ${role}.${permission} = ${isAllowed ? "allow" : "deny"}`,
    });

    revalidatePath("/admin/settings/permissions");
    revalidatePath("/");
  } catch (error) {
    return userFacingError(error, "เกิดข้อผิดพลาด");
  }

  return null;
}
