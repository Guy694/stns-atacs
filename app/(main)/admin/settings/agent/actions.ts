"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AgentUninstallMigrationError,
  cancelAgentUninstall,
  createAgentEnrollment,
  getAgentDeviceById,
  getAgentDeviceFacilityId,
  getAgentEnrollmentFacilityId,
  linkAgentDeviceToAsset,
  requestAgentUninstall,
  retireAgentDevice,
  revokeAgentEnrollment,
} from "@/lib/agent";
import { AGENT_UNINSTALL_MIGRATION_MESSAGE, agentVersionSupportsSelfUninstall } from "@/lib/agent-uninstall";
import { parseAgentAutoUpdateMode, parsePilotFacilityIds } from "@/lib/agent-update";
import { getAgentAutoUpdateSettings, setAgentAutoUpdateSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog, writeAuditLogSafe } from "@/lib/audit";
import { getAssetById, listAllFacilitiesForSelect } from "@/lib/assets";
import { canAccessFacility, getFacilityScopeId } from "@/lib/facility-scope";
import { getActiveFacilityWorkGroupForFacility, getFacilityAgentContext } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import { recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";
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
  const workGroupIdInput = Number(formData.get("workGroupId"));
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

  if (facility.requiresWorkGroup && (!workGroupIdInput || Number.isNaN(workGroupIdInput))) {
    return { ...agentEnrollmentInitialState, error: "หน่วยงานประเภทโรงพยาบาล / สสจ / สสอ ต้องเลือกกลุ่มงาน" };
  }

  let workGroupId: number | null = null;
  let selectedWorkGroupName = "";
  try {
    if (facility.requiresWorkGroup) {
      const workGroup = await getActiveFacilityWorkGroupForFacility(facility.id, workGroupIdInput);
      if (!workGroup) return { ...agentEnrollmentInitialState, error: "ไม่พบกลุ่มงานนี้ในหน่วยงาน กรุณาเลือกจากรายการกลุ่มงานที่มีอยู่" };
      workGroupId = workGroup.id;
      selectedWorkGroupName = workGroup.workGroupName;
    }
  } catch {
    return { ...agentEnrollmentInitialState, error: "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน" };
  }

  const enrollmentName = facility.requiresWorkGroup
    ? `${facility.name} · ${selectedWorkGroupName}`
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
  try {
    await linkAgentDeviceToAsset(deviceId, parsedAssetId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ไม่สามารถเชื่อม Agent ได้" };
  }
  revalidatePath("/admin/settings/agent");
}

const AUTO_UPDATE_MODE_LABELS = { off: "ปิด", pilot: "นำร่อง", all: "ทุกหน่วยงาน" } as const;

/** ตั้งค่าอัปเดต Agent อัตโนมัติ (มีผลทุกหน่วยงาน จึงจำกัดเฉพาะผู้ดูแลระบบส่วนกลาง) */
export async function updateAgentAutoUpdateAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" || getFacilityScopeId(user) !== undefined) redirect("/dashboard");

  const rawMode = String(formData.get("mode") ?? "");
  const mode = parseAgentAutoUpdateMode(rawMode);
  if (mode !== rawMode) redirect("/admin/settings/agent/?autoUpdate=invalid");

  const knownFacilityIds = new Set((await listAllFacilitiesForSelect()).map((facility) => Number(facility.id)));
  const pilotFacilityIds = parsePilotFacilityIds(formData.getAll("pilotFacilityIds").map(String).join(","))
    .filter((id) => knownFacilityIds.has(id));
  if (mode === "pilot" && pilotFacilityIds.length === 0) redirect("/admin/settings/agent/?autoUpdate=no-pilot");

  const previous = await getAgentAutoUpdateSettings();
  try {
    await setAgentAutoUpdateSettings({ mode, pilotFacilityIds });
  } catch (error) {
    const code = error instanceof Error && error.message === "PILOT_LIST_TOO_LONG" ? "too-many" : "failed";
    redirect(`/admin/settings/agent/?autoUpdate=${code}`);
  }

  await writeAuditLog({
    userId: user.id,
    userName: user.fullName,
    action: "update",
    entity: "app_settings",
    summary: `ตั้งค่าอัปเดต Agent อัตโนมัติ: ${AUTO_UPDATE_MODE_LABELS[previous.mode]} -> ${AUTO_UPDATE_MODE_LABELS[mode]}`
      + ` · หน่วยงานนำร่อง [${pilotFacilityIds.join(", ") || "-"}]`,
  });

  revalidatePath("/admin/settings/agent");
  redirect("/admin/settings/agent/?autoUpdate=saved");
}

export type AgentDeviceLifecycleActionResult = { ok: boolean; message: string };

/** ถอนการติดตั้ง/ลบออกจากระบบมีผลกับเครื่องในทุกหน่วยงาน: เฉพาะผู้ดูแลระบบส่วนกลาง (เหมือนการตั้งค่าอัปเดตอัตโนมัติ) */
async function requireGlobalAgentAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || getFacilityScopeId(user) !== undefined) return null;
  return user;
}

const NOT_ALLOWED: AgentDeviceLifecycleActionResult = { ok: false, message: "เฉพาะผู้ดูแลระบบส่วนกลางเท่านั้นที่ถอนการติดตั้งหรือลบ Agent ออกจากระบบได้" };

async function loadLifecycleTarget(formData: FormData) {
  const deviceId = Number(formData.get("deviceId"));
  if (!Number.isSafeInteger(deviceId) || deviceId <= 0) return null;
  return getAgentDeviceById(deviceId);
}

function deviceLabel(device: { id: number; hostname: string | null }) {
  return device.hostname ?? `Device #${device.id}`;
}

export async function requestAgentUninstallAction(formData: FormData): Promise<AgentDeviceLifecycleActionResult> {
  const user = await requireGlobalAgentAdmin();
  if (!user) return NOT_ALLOWED;
  const device = await loadLifecycleTarget(formData);
  if (!device) return { ok: false, message: "ไม่พบเครื่องนี้" };

  let outcome: Awaited<ReturnType<typeof requestAgentUninstall>>;
  try {
    outcome = await requestAgentUninstall(device.id, user.fullName || `user#${user.id}`);
  } catch (error) {
    if (error instanceof AgentUninstallMigrationError) return { ok: false, message: AGENT_UNINSTALL_MIGRATION_MESSAGE };
    console.error("[agent-uninstall] request failed", error);
    return { ok: false, message: "สั่งถอนการติดตั้งไม่สำเร็จ กรุณาลองใหม่" };
  }
  if (outcome === "not-found") return { ok: false, message: "ไม่พบเครื่องนี้" };
  if (outcome === "inactive") return { ok: false, message: "เครื่องนี้ถอนการติดตั้งหรือลบออกจากระบบไปแล้ว" };
  if (outcome === "already-pending") return { ok: true, message: "มีคำสั่งถอนการติดตั้งค้างอยู่แล้ว" };

  const label = deviceLabel(device);
  const selfUninstall = agentVersionSupportsSelfUninstall(device.agentVersion);
  await writeAuditLogSafe({
    userId: user.id,
    userName: user.fullName,
    action: "delete",
    entity: "agent_devices",
    entityId: device.id,
    summary: `สั่งถอนการติดตั้ง Agent: ${label} (${device.facilityName}) · รุ่น ${device.agentVersion ?? "-"}`,
  });
  await recordSecurityEvent({
    eventType: "agent_uninstall_requested",
    identity: user.fullName,
    path: "/admin/settings/agent",
    detail: `Device #${device.id} ${label} · ${device.facilityName} · Agent ${device.agentVersion ?? "-"}`,
    skipBurstAlert: true,
  });
  await notifyTelegramSafe({
    category: "agent",
    title: "สั่งถอนการติดตั้ง Agent",
    eventKey: `agent-uninstall-requested:${device.id}:${Date.now()}`,
    details: {
      เครื่อง: label,
      หน่วยงาน: device.facilityName,
      "Agent ID": device.agentUuid,
      เวอร์ชัน: device.agentVersion ?? "-",
      "สั่งโดย": user.fullName,
      ...(selfUninstall ? {} : { หมายเหตุ: "Agent รุ่นนี้ถอนเองไม่ได้ ต้องถอนด้วยมือหรือ ลบออกจากระบบ" }),
    },
  });
  revalidatePath("/admin/settings/agent");
  revalidatePath("/agent-monitor");
  return {
    ok: true,
    message: selfUninstall
      ? `สั่งถอนการติดตั้ง ${label} แล้ว — Agent จะถอนตัวเองในรอบรายงานถัดไป (ภายใน ~4 ชั่วโมง หรือเมื่อเปิดเครื่อง)`
      : `บันทึกคำสั่งแล้ว แต่ Agent รุ่น ${device.agentVersion ?? "ไม่ทราบ"} ถอนเองไม่ได้ — ใช้คำสั่งถอนด้วยมือ หรือ “ลบออกจากระบบ”`,
  };
}

export async function cancelAgentUninstallAction(formData: FormData): Promise<AgentDeviceLifecycleActionResult> {
  const user = await requireGlobalAgentAdmin();
  if (!user) return NOT_ALLOWED;
  const device = await loadLifecycleTarget(formData);
  if (!device) return { ok: false, message: "ไม่พบเครื่องนี้" };

  let outcome: Awaited<ReturnType<typeof cancelAgentUninstall>>;
  try {
    outcome = await cancelAgentUninstall(device.id);
  } catch (error) {
    if (error instanceof AgentUninstallMigrationError) return { ok: false, message: AGENT_UNINSTALL_MIGRATION_MESSAGE };
    console.error("[agent-uninstall] cancel failed", error);
    return { ok: false, message: "ยกเลิกคำสั่งไม่สำเร็จ กรุณาลองใหม่" };
  }
  if (outcome === "not-found") return { ok: false, message: "ไม่พบเครื่องนี้" };
  if (outcome === "not-pending") return { ok: false, message: "ไม่มีคำสั่งค้างอยู่ (เครื่องอาจถอนการติดตั้งไปแล้ว)" };

  const label = deviceLabel(device);
  await writeAuditLogSafe({
    userId: user.id,
    userName: user.fullName,
    action: "update",
    entity: "agent_devices",
    entityId: device.id,
    summary: `ยกเลิกคำสั่งถอนการติดตั้ง Agent: ${label} (${device.facilityName})`,
  });
  revalidatePath("/admin/settings/agent");
  revalidatePath("/agent-monitor");
  return { ok: true, message: `ยกเลิกคำสั่งถอนการติดตั้ง ${label} แล้ว` };
}

export async function retireAgentDeviceAction(formData: FormData): Promise<AgentDeviceLifecycleActionResult> {
  const user = await requireGlobalAgentAdmin();
  if (!user) return NOT_ALLOWED;
  const device = await loadLifecycleTarget(formData);
  if (!device) return { ok: false, message: "ไม่พบเครื่องนี้" };

  let outcome: Awaited<ReturnType<typeof retireAgentDevice>>;
  try {
    outcome = await retireAgentDevice(device.id);
  } catch (error) {
    console.error("[agent-retire] failed", error);
    return { ok: false, message: "ลบออกจากระบบไม่สำเร็จ กรุณาลองใหม่" };
  }
  if (outcome === "already-inactive") return { ok: false, message: "เครื่องนี้ถอนการติดตั้งหรือลบออกจากระบบไปแล้ว" };

  const label = deviceLabel(device);
  await writeAuditLogSafe({
    userId: user.id,
    userName: user.fullName,
    action: "delete",
    entity: "agent_devices",
    entityId: device.id,
    summary: `ลบ Agent ออกจากระบบ (ยกเลิกกุญแจ เก็บประวัติ): ${label} (${device.facilityName}) · พบล่าสุด ${device.lastReportedLabel ?? "-"}`,
  });
  await recordSecurityEvent({
    eventType: "agent_retired",
    identity: user.fullName,
    path: "/admin/settings/agent",
    detail: `Device #${device.id} ${label} · ${device.facilityName} · กุญแจถูกยกเลิก`,
    skipBurstAlert: true,
  });
  await notifyTelegramSafe({
    category: "agent",
    title: "ลบ Agent ออกจากระบบ — กุญแจของเครื่องถูกยกเลิก",
    eventKey: `agent-retired:${device.id}:${Date.now()}`,
    details: { เครื่อง: label, หน่วยงาน: device.facilityName, "Agent ID": device.agentUuid, "ทำโดย": user.fullName },
  });
  revalidatePath("/admin/settings/agent");
  revalidatePath("/agent-monitor");
  return { ok: true, message: `ลบ ${label} ออกจากระบบแล้ว — รายงานจากเครื่องนี้จะถูกปฏิเสธ ประวัติและทะเบียนยังอยู่` };
}
