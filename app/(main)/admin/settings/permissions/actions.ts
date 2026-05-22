"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission, type AppRole, type PermissionKey, upsertRolePermission } from "@/lib/role-permissions";

async function requirePermissionManager() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "admin") {
    return user;
  }

  const canManagePermissions = await hasPermission(user.role, "permissions.manage");
  if (!canManagePermissions) redirect("/");

  return user;
}

export async function updateRolePermissionAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const actor = await requirePermissionManager();

  const role = String(formData.get("role") ?? "") as AppRole;
  const permission = String(formData.get("permission") ?? "") as PermissionKey;
  const isAllowed = String(formData.get("isAllowed") ?? "") === "1";

  if (!["admin", "officer", "viewer"].includes(role)) {
    return "Role ไม่ถูกต้อง";
  }

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
    return error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
  }

  return null;
}
