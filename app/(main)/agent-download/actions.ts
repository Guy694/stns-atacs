"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAgentEnrollment } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import { findOrCreateFacilityWorkGroup, getFacilityAgentContext, normalizeWorkGroupName } from "@/lib/facility-work-groups";
import { executeStatement, selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

async function requireOfficerWithFacility() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
  } catch {
    return { token: null, error: "บัญชีของคุณยังไม่ได้ผูกกับหน่วยงาน กรุณาติดต่อผู้ดูแลระบบ", enrollmentName: null };
  }

  const facility = await getFacilityAgentContext(user.facilityId!);
  if (!facility) {
    return { token: null, error: "ไม่พบข้อมูลหน่วยงานของบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบ", enrollmentName: null };
  }

  const workGroupName = normalizeWorkGroupName(String(formData.get("workGroupName") ?? ""));
  if (facility.requiresWorkGroup && workGroupName.length < 2) {
    return { token: null, error: "หน่วยงานประเภทโรงพยาบาล / สสจ / สสอ ต้องระบุชื่อกลุ่มงานก่อนสร้าง token", enrollmentName: null };
  }
  if (workGroupName.length > 150) {
    return { token: null, error: "ชื่อกลุ่มงานต้องไม่เกิน 150 ตัวอักษร", enrollmentName: null };
  }

  let workGroupId: number | null = null;
  try {
    if (facility.requiresWorkGroup) {
      workGroupId = await findOrCreateFacilityWorkGroup(facility.id, workGroupName);
      if (!workGroupId) {
        return { token: null, error: "ไม่สามารถบันทึกชื่อกลุ่มงานได้", enrollmentName: null };
      }
    }
  } catch {
    return { token: null, error: "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน", enrollmentName: null };
  }

  const enrollmentName = facility.requiresWorkGroup
    ? `${facility.name} · ${workGroupName} · สร้างโดย ${user.fullName}`
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
