"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { MAINTENANCE_MESSAGE_MAX, setMaintenanceState } from "@/lib/maintenance";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // โหมดปิดปรับปรุงกระทบผู้ใช้ทั้งระบบ จึงจำกัดไว้ที่ผู้ดูแลระบบเท่านั้น
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export async function updateMaintenanceModeAction(formData: FormData) {
  const actor = await requireAdmin();

  const enabled = String(formData.get("enabled") ?? "false") === "true";
  const message = String(formData.get("message") ?? "").trim().slice(0, MAINTENANCE_MESSAGE_MAX);
  const expectedBack = String(formData.get("expectedBack") ?? "").trim().slice(0, MAINTENANCE_MESSAGE_MAX);

  await setMaintenanceState({ enabled, message, expectedBack, actorName: actor.fullName });

  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "app_settings",
    summary: enabled
      ? `เปิดโหมดปิดปรับปรุงระบบ${expectedBack ? ` (คาดว่ากลับมา ${expectedBack})` : ""}`
      : "ปิดโหมดปิดปรับปรุงระบบ ผู้ใช้เข้าใช้งานได้ตามปกติ",
  });

  // หน้าที่ได้รับผลกระทบโดยตรง
  revalidatePath("/", "layout");
  revalidatePath("/maintenance");
  revalidatePath("/admin/settings/maintenance");

  const notice = enabled
    ? "เปิดโหมดปิดปรับปรุงแล้ว ผู้ใช้ทั่วไปจะเห็นหน้าปิดปรับปรุงและเข้าสู่ระบบไม่ได้"
    : "ปิดโหมดปิดปรับปรุงแล้ว ผู้ใช้ทุกคนเข้าใช้งานได้ตามปกติ";
  redirect(`/admin/settings/maintenance?notice=${encodeURIComponent(notice)}`);
}
