"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  findOrCreateFacilityWorkGroup,
  getFacilityWorkGroupById,
  listManageableWorkGroupFacilitiesForUser,
  normalizeWorkGroupName,
  setFacilityWorkGroupActive,
} from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";

async function requireWorkGroupManager() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "admin") return user;
  if (await hasPermission(user.role, "work-groups.manage")) return user;

  redirect("/dashboard");
}

async function listAllowedFacilities() {
  const user = await requireWorkGroupManager();
  const facilities = await listManageableWorkGroupFacilitiesForUser({
    role: user.role,
    facilityId: user.facilityId,
  });
  return { user, facilities };
}

function revalidateWorkGroupPages() {
  revalidatePath("/admin/settings/work-groups");
  revalidatePath("/admin/settings/agent");
  revalidatePath("/agent-download");
}

export async function createFacilityWorkGroupAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const { user, facilities } = await listAllowedFacilities();
  const facilityId = Number(formData.get("facilityId"));
  const workGroupName = normalizeWorkGroupName((formData.get("workGroupName") as string | null) ?? "");

  if (!facilityId || Number.isNaN(facilityId)) return "กรุณาเลือกหน่วยงาน";
  if (workGroupName.length < 2) return "กรุณากรอกชื่อกลุ่มงานอย่างน้อย 2 ตัวอักษร";
  if (workGroupName.length > 150) return "ชื่อกลุ่มงานต้องไม่เกิน 150 ตัวอักษร";

  const facility = facilities.find((item) => item.id === facilityId);
  if (!facility) return "คุณไม่มีสิทธิ์สร้างกลุ่มงานให้หน่วยงานนี้";
  if (!facility.requiresWorkGroup) return "หน่วยงานประเภทนี้ไม่ต้องระบุกลุ่มงาน";

  try {
    const workGroupId = await findOrCreateFacilityWorkGroup(facility.id, workGroupName);
    if (!workGroupId) return "ไม่สามารถบันทึกกลุ่มงานได้";

    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "create",
      entity: "facility_work_groups",
      entityId: workGroupId,
      summary: `สร้างกลุ่มงาน ${workGroupName} ของ ${facility.name}`,
    });

    revalidateWorkGroupPages();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("facility_work_groups")) {
      return "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน";
    }
    return "เกิดข้อผิดพลาดระหว่างบันทึกกลุ่มงาน";
  }
}

export async function toggleFacilityWorkGroupActiveAction(id: number, active: boolean): Promise<void> {
  const { user, facilities } = await listAllowedFacilities();
  const workGroup = await getFacilityWorkGroupById(id);
  if (!workGroup) return;
  if (!facilities.some((facility) => facility.id === workGroup.facilityId)) return;

  await setFacilityWorkGroupActive(id, active);
  await writeAuditLog({
    userId: user.id,
    userName: user.fullName,
    action: "update",
    entity: "facility_work_groups",
    entityId: id,
    summary: `${active ? "เปิดใช้งาน" : "ปิดใช้งาน"}กลุ่มงาน ${workGroup.workGroupName} ของ ${workGroup.facilityName}`,
  });

  revalidateWorkGroupPages();
}
