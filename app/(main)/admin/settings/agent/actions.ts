"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AgentUninstallMigrationError,
  cancelAgentUninstall,
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
import { hasPermission } from "@/lib/role-permissions";
import { recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";
import { issueInstallCommand, revokeInstallScope } from "./install-command";
import type { InstallCommandRequest, InstallCommandResult, RevokeInstallCommandResult } from "./types";
import { userFacingError } from "@/lib/schema-errors";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowAgentManage = user.role === "admin" || (await hasPermission(user.role, "agent.manage"));
  if (!allowAgentManage) redirect("/dashboard");
  return user;
}

/** ผู้ที่สร้างคำสั่งติดตั้งได้: admin หรือบทบาทที่มีสิทธิ์ agent.manage (ขอบเขตหน่วยงานตรวจซ้ำใน install-command.ts) */
async function currentAgentManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  const allowAgentManage = user.role === "admin" || (await hasPermission(user.role, "agent.manage"));
  return allowAgentManage ? user : null;
}

/** คืนคำสั่งติดตั้งของหน่วยงาน (+กลุ่มงาน) ที่เลือก ระบบสร้าง/ใช้รหัสเฉพาะหน่วยงานให้เองเบื้องหลัง */
export async function getInstallCommand(input: InstallCommandRequest): Promise<InstallCommandResult> {
  const user = await currentAgentManager();
  if (!user) return { ok: false, error: "คุณไม่มีสิทธิ์สร้างคำสั่งติดตั้ง Agent" };
  const result = await issueInstallCommand(user, input);
  if (result.ok && result.created) revalidatePath("/admin/settings/agent");
  return result;
}

/** ยกเลิกรหัสติดตั้งของหน่วยงาน (+กลุ่มงาน): คำสั่งที่คัดลอกไปแล้วจะใช้ไม่ได้ ครั้งถัดไปจะได้รหัสใหม่ */
export async function revokeInstallCommand(input: { facilityId: number; workGroupId: number | null }): Promise<RevokeInstallCommandResult> {
  const user = await currentAgentManager();
  if (!user) return { ok: false, message: "คุณไม่มีสิทธิ์ยกเลิกรหัสติดตั้ง Agent" };
  const result = await revokeInstallScope(user, input);
  if (result.ok) {
    revalidatePath("/admin/settings/agent");
    revalidatePath("/agent-download");
  }
  return result;
}

export async function revokeAgentEnrollmentAction(formData: FormData) {
  const user = await requireAdmin();
  const id = Number(formData.get("enrollmentId"));
  if (!id || Number.isNaN(id)) return;
  const facilityId = await getAgentEnrollmentFacilityId(id);
  if (!canAccessFacility(user, facilityId)) return;
  await revokeAgentEnrollment(id);
  await writeAuditLogSafe({
    userId: user.id,
    userName: user.fullName,
    action: "delete",
    entity: "agent_enrollments",
    entityId: id,
    summary: `ปิดรหัสติดตั้ง Agent แบบเดิม #${id}`,
  });
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
    return { error: userFacingError(error, "ไม่สามารถเชื่อม Agent ได้") };
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
