"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAgentEnrollment } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import { getActiveFacilityWorkGroupForFacility, getFacilityAgentContext } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import { executeStatement, selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

async function requireOfficerWithFacility() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // SEC-03: เดิมสร้าง enrollment token อายุ 7 วันได้โดยไม่ตรวจสิทธิ์
  if (user.role === "viewer") throw new Error("FORBIDDEN");
  if (!(user.role === "admin" || (await hasPermission(user.role, "agent.manage")))) throw new Error("FORBIDDEN");
  if (!user.facilityId) throw new Error("NO_FACILITY");
  return user;
}

type TokenRow = RowDataPacket & { id: number };

/** สร้าง token ใหม่สำหรับ officer self-service (revoke อันเก่าก่อน) */
export async function createOfficerDownloadTokenAction(
  _prev: { token: string | null; error: string | null; enrollmentName: string | null },
  formData: FormData
): Promise<{
  token: string | null;
  error: string | null;
  enrollmentName: string | null;
}> {
  let user;
  try {
    user = await requireOfficerWithFacility();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") {
      return { token: null, error: "คุณไม่มีสิทธิ์สร้าง token ติดตั้ง Agent", enrollmentName: null };
    }
    return { token: null, error: "บัญชีของคุณยังไม่ได้ผูกกับหน่วยงาน กรุณาติดต่อผู้ดูแลระบบ", enrollmentName: null };
  }

  const facility = await getFacilityAgentContext(user.facilityId!);
  if (!facility) {
    return { token: null, error: "ไม่พบข้อมูลหน่วยงานของบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบ", enrollmentName: null };
  }

  const workGroupIdInput = Number(formData.get("workGroupId"));
  if (facility.requiresWorkGroup && (!workGroupIdInput || Number.isNaN(workGroupIdInput))) {
    return { token: null, error: "หน่วยงานประเภทโรงพยาบาล / สสจ / สสอ ต้องเลือกกลุ่มงานก่อนสร้าง token", enrollmentName: null };
  }

  let workGroupId: number | null = null;
  let selectedWorkGroupName = "";
  try {
    if (facility.requiresWorkGroup) {
      const workGroup = await getActiveFacilityWorkGroupForFacility(facility.id, workGroupIdInput);
      if (!workGroup) {
        return { token: null, error: "ไม่พบกลุ่มงานนี้ในหน่วยงาน กรุณาเลือกจากรายการกลุ่มงานที่มีอยู่", enrollmentName: null };
      }
      workGroupId = workGroup.id;
      selectedWorkGroupName = workGroup.workGroupName;
    }
  } catch {
    return { token: null, error: "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน", enrollmentName: null };
  }

  const enrollmentName = facility.requiresWorkGroup
    ? `${facility.name} · ${selectedWorkGroupName} · สร้างโดย ${user.fullName}`
    : `${facility.name} · สร้างโดย ${user.fullName}`;

  // revoke token เดิมของชื่อเครื่อง/กลุ่มงานนี้ก่อน
  try {
    const old = await selectRows<TokenRow>(
      "SELECT id FROM agent_enrollments WHERE enrollment_name = ? AND created_by_user_id = ? AND is_active = 1",
      [enrollmentName, Number(user.id)]
    );
    for (const row of old) {
      await executeStatement("UPDATE agent_enrollments SET is_active = 0 WHERE id = ?", [row.id]);
    }
  } catch {
    // ถ้า table ยังไม่มีก็ข้ามไป
  }

  try {
    const token = await createAgentEnrollment({
      facilityId: facility.id,
      workGroupId,
      enrollmentName,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19),
      createdByUserId: Number(user.id),
    });
    revalidatePath("/agent-download");
    return { token, error: null, enrollmentName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("agent_enrollments")) {
      return { token: null, error: "ยังไม่พบตาราง agent_enrollments กรุณารัน database/agent_inventory.sql ก่อน", enrollmentName: null };
    }
    if (msg.includes("facility_work_groups") || msg.includes("work_group_id")) {
      return { token: null, error: "ยังไม่พบโครงสร้างกลุ่มงาน กรุณารัน database/add_facility_work_groups.sql ก่อน", enrollmentName: null };
    }
    return { token: null, error: "ไม่สามารถสร้าง enrollment token ได้", enrollmentName: null };
  }
}
