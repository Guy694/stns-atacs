"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createAgentEnrollment,
  getAgentDeviceFacilityId,
  getAgentEnrollmentFacilityId,
  linkAgentDeviceToAsset,
  revokeAgentEnrollment,
} from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById } from "@/lib/assets";
import { canAccessFacility } from "@/lib/facility-scope";
import { findOrCreateFacilityWorkGroup, getFacilityAgentContext, normalizeWorkGroupName } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import type { AgentEnrollmentActionState } from "./types";
import { agentEnrollmentInitialState } from "./types";

export type { AgentEnrollmentActionState } from "./types";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowAgentManage = user.role === "admin" || (await hasPermission(user.role, "agent.manage"));
  if (!allowAgentManage) redirect("/dashboard");
  return user;
}

export async function createAgentEnrollmentAction(
  _prev: AgentEnrollmentActionState,
  formData: FormData
): Promise<AgentEnrollmentActionState> {
  const user = await requireAdmin();

  const facilityId = Number(formData.get("facilityId"));
  const workGroupName = normalizeWorkGroupName((formData.get("workGroupName") as string | null) ?? "");
  const expiresAt = (formData.get("expiresAt") as string | null)?.trim() ?? "";

  if (!facilityId || Number.isNaN(facilityId)) {
    return { ...agentEnrollmentInitialState, error: "กรุณาเลือกหน่วยงาน" };
  }

  const facility = await getFacilityAgentContext(facilityId);
  if (!facility) {
    return { ...agentEnrollmentInitialState, error: "ไม่พบข้อมูลหน่วยงานที่เลือก" };
  }
  if (!canAccessFacility(user, facility.id)) {
    return { ...agentEnrollmentInitialState, error: "คุณไม่มีสิทธิ์สร้าง token ให้หน่วยงานนี้" };
  }

  if (facility.requiresWorkGroup && workGroupName.length < 2) {
    return { ...agentEnrollmentInitialState, error: "หน่วยงานประเภทโรงพยาบาล / สสจ / สสอ ต้องระบุชื่อกลุ่มงาน" };
  }
  if (workGroupName.length > 150) {
    return { ...agentEnrollmentInitialState, error: "ชื่อกลุ่มงานต้องไม่เกิน 150 ตัวอักษร" };
  }

  let workGroupId: number | null = null;
  try {
    if (facility.requiresWorkGroup) {
      workGroupId = await findOrCreateFacilityWorkGroup(facility.id, workGroupName);
      if (!workGroupId) return { ...agentEnrollmentInitialState, error: "ไม่สามารถบันทึกชื่อกลุ่มงานได้" };
    }
  } catch {
    return { ...agentEnrollmentInitialState, error: "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน" };
  }

  const enrollmentName = facility.requiresWorkGroup
    ? `${facility.name} · ${workGroupName}`
    : facility.name;

  try {
    const createdToken = await createAgentEnrollment({
      facilityId: facility.id,
      workGroupId,
      enrollmentName,
      expiresAt,
      createdByUserId: Number(user.id),
    });
    revalidatePath("/admin/settings/agent");
    return {
      error: null,
      createdToken,
      facilityName: facility.name,
      enrollmentName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("agent_enrollments")) {
      return { ...agentEnrollmentInitialState, error: "ยังไม่พบตาราง agent_enrollments กรุณารัน database/agent_inventory.sql ก่อน" };
    }
    if (message.includes("facility_work_groups") || message.includes("work_group_id")) {
      return { ...agentEnrollmentInitialState, error: "ยังไม่พบโครงสร้างกลุ่มงาน กรุณารัน database/add_facility_work_groups.sql ก่อน" };
    }
    return { ...agentEnrollmentInitialState, error: "ไม่สามารถสร้าง enrollment token ได้" };
  }
}

export async function revokeAgentEnrollmentAction(formData: FormData) {
  const user = await requireAdmin();
  const id = Number(formData.get("enrollmentId"));
  if (!id || Number.isNaN(id)) return;
  const facilityId = await getAgentEnrollmentFacilityId(id);
  if (!canAccessFacility(user, facilityId)) return;
  await revokeAgentEnrollment(id);
  revalidatePath("/admin/settings/agent");
}

export async function linkAgentDeviceAction(formData: FormData) {
  const user = await requireAdmin();
  const deviceId = Number(formData.get("deviceId"));
  const assetId = formData.get("assetId");
  if (!deviceId || Number.isNaN(deviceId)) return;
  const deviceFacilityId = await getAgentDeviceFacilityId(deviceId);
  if (!canAccessFacility(user, deviceFacilityId)) return;
  const parsedAssetId = assetId ? Number(assetId) : null;
  if (parsedAssetId) {
    const asset = await getAssetById(parsedAssetId);
    if (!asset || !canAccessFacility(user, asset.facilityId) || asset.facilityId !== deviceFacilityId) return;
  }
  await linkAgentDeviceToAsset(deviceId, parsedAssetId);
  revalidatePath("/admin/settings/agent");
}
