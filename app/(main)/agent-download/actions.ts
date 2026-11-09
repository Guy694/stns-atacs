"use server";

import { revalidatePath } from "next/cache";

import { issueInstallCommand } from "@/app/(main)/admin/settings/agent/install-command";
import type { InstallCommandRequest, InstallCommandResult } from "@/app/(main)/admin/settings/agent/types";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";

/**
 * คำสั่งติดตั้ง Agent สำหรับเจ้าหน้าที่ (หน้า ดาวน์โหลด Agent)
 * SEC-03: ต้องไม่ใช่ viewer และมีสิทธิ์ agent.manage; ขอบเขตหน่วยงานตรวจซ้ำด้วย canAccessFacility
 * ระบบสร้าง/ใช้รหัสเฉพาะหน่วยงานให้เองเบื้องหลัง ผู้ใช้ไม่เห็นและไม่ต้องจัดการรหัส
 */
export async function getDownloadInstallCommand(input: InstallCommandRequest): Promise<InstallCommandResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };
  if (user.role === "viewer" || !(user.role === "admin" || (await hasPermission(user.role, "agent.manage")))) {
    return { ok: false, error: "คุณไม่มีสิทธิ์สร้างคำสั่งติดตั้ง Agent" };
  }
  const result = await issueInstallCommand(user, input);
  if (result.ok && result.created) revalidatePath("/admin/settings/agent");
  return result;
}
