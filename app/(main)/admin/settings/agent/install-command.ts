import "server-only";

import { getOrCreateInstallScopeToken, revokeInstallScopeEnrollments } from "@/lib/agent";
import { buildAgentInstallCommand, installScopeEnrollmentName, parseInstallOs } from "@/lib/agent-install-command";
import type { getCurrentUser } from "@/lib/auth";
import { writeAuditLogSafe } from "@/lib/audit";
import { canAccessFacility } from "@/lib/facility-scope";
import { getActiveFacilityWorkGroupForFacility, getFacilityAgentContext } from "@/lib/facility-work-groups";

import type { InstallCommandRequest, InstallCommandResult, RevokeInstallCommandResult } from "./types";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type ResolvedScope =
  | { ok: true; facilityId: number; facilityName: string; workGroupId: number | null; workGroupName: string | null }
  | { ok: false; error: string };

/** ตรวจหน่วยงาน/กลุ่มงานที่ขอ และสิทธิ์ของผู้ใช้ต่อหน่วยงานนั้น (ใช้ร่วมกันทั้งหน้าตั้งค่าและหน้าดาวน์โหลด) */
async function resolveInstallScope(user: SessionUser, input: { facilityId: unknown; workGroupId?: unknown }): Promise<ResolvedScope> {
  const facilityId = Number(input.facilityId);
  if (!Number.isSafeInteger(facilityId) || facilityId <= 0) return { ok: false, error: "กรุณาเลือกหน่วยงาน" };

  const facility = await getFacilityAgentContext(facilityId);
  if (!facility) return { ok: false, error: "ไม่พบข้อมูลหน่วยงานที่เลือก" };
  if (!canAccessFacility(user, facility.id)) return { ok: false, error: "คุณไม่มีสิทธิ์จัดการคำสั่งติดตั้งของหน่วยงานนี้" };
  if (!facility.requiresWorkGroup) return { ok: true, facilityId: facility.id, facilityName: facility.name, workGroupId: null, workGroupName: null };

  const workGroupId = Number(input.workGroupId);
  if (!Number.isSafeInteger(workGroupId) || workGroupId <= 0) {
    return { ok: false, error: "หน่วยงานประเภทโรงพยาบาล / สสจ. / สสอ. ต้องเลือกกลุ่มงาน" };
  }
  try {
    const workGroup = await getActiveFacilityWorkGroupForFacility(facility.id, workGroupId);
    if (!workGroup) return { ok: false, error: "ไม่พบกลุ่มงานนี้ในหน่วยงาน กรุณาเลือกจากรายการ" };
    return { ok: true, facilityId: facility.id, facilityName: facility.name, workGroupId: workGroup.id, workGroupName: workGroup.workGroupName };
  } catch {
    return { ok: false, error: "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน" };
  }
}

function scopeLabel(scope: { facilityName: string; workGroupName: string | null }) {
  return scope.workGroupName ? `${scope.facilityName} · ${scope.workGroupName}` : scope.facilityName;
}

export async function issueInstallCommand(user: SessionUser, input: InstallCommandRequest): Promise<InstallCommandResult> {
  const os = parseInstallOs(input?.os);
  if (!os) return { ok: false, error: "ระบบปฏิบัติการไม่ถูกต้อง" };
  const scope = await resolveInstallScope(user, input ?? {});
  if (!scope.ok) return scope;

  let issued: Awaited<ReturnType<typeof getOrCreateInstallScopeToken>>;
  try {
    issued = await getOrCreateInstallScopeToken({
      facilityId: scope.facilityId,
      workGroupId: scope.workGroupId,
      enrollmentName: installScopeEnrollmentName(scope.facilityName, scope.workGroupName),
      createdByUserId: Number(user.id) || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("AUTH_SECRET")) {
      console.error("[agent-install] AUTH_SECRET is not configured");
      return { ok: false, error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า AUTH_SECRET จึงออกคำสั่งติดตั้งไม่ได้ กรุณาแจ้งผู้ดูแลระบบ" };
    }
    if (message.includes("agent_enrollments")) return { ok: false, error: "ยังไม่พบตาราง agent_enrollments กรุณารัน database/agent_inventory.sql ก่อน" };
    console.error("[agent-install] issue failed", error);
    return { ok: false, error: "สร้างคำสั่งติดตั้งไม่สำเร็จ กรุณาลองใหม่" };
  }

  await writeAuditLogSafe({
    userId: user.id,
    userName: user.fullName,
    action: issued.created ? "create" : "update",
    entity: "agent_enrollments",
    entityId: issued.enrollmentId,
    summary: `${issued.created ? "เปิดรหัสติดตั้ง Agent และคัดลอกคำสั่ง" : "คัดลอกคำสั่งติดตั้ง Agent"} (${os === "linux" ? "Linux" : "Windows"}): ${scopeLabel(scope)}`
      + (issued.rotated ? ` · ปิดรหัสเดิมที่ตรวจไม่ผ่าน ${issued.rotated} รายการ` : ""),
  });

  return {
    ok: true,
    command: buildAgentInstallCommand(os, issued.token),
    created: issued.created,
    scopeLabel: scopeLabel(scope),
  };
}

export async function revokeInstallScope(user: SessionUser, input: { facilityId: unknown; workGroupId?: unknown }): Promise<RevokeInstallCommandResult> {
  const facilityId = Number(input?.facilityId);
  if (!Number.isSafeInteger(facilityId) || facilityId <= 0) return { ok: false, message: "กรุณาเลือกหน่วยงาน" };
  if (!canAccessFacility(user, facilityId)) return { ok: false, message: "คุณไม่มีสิทธิ์จัดการคำสั่งติดตั้งของหน่วยงานนี้" };
  const rawWorkGroupId = Number(input?.workGroupId);
  const workGroupId = Number.isSafeInteger(rawWorkGroupId) && rawWorkGroupId > 0 ? rawWorkGroupId : null;

  let revoked = 0;
  try {
    revoked = await revokeInstallScopeEnrollments({ facilityId, workGroupId });
  } catch (error) {
    console.error("[agent-install] revoke failed", error);
    return { ok: false, message: "ยกเลิกรหัสติดตั้งไม่สำเร็จ กรุณาลองใหม่" };
  }
  if (revoked === 0) return { ok: false, message: "ไม่มีรหัสติดตั้งที่เปิดอยู่สำหรับหน่วยงานนี้" };

  const facility = await getFacilityAgentContext(facilityId).catch(() => null);
  await writeAuditLogSafe({
    userId: user.id,
    userName: user.fullName,
    action: "delete",
    entity: "agent_enrollments",
    summary: `ยกเลิกรหัสติดตั้ง Agent: ${facility?.name ?? `หน่วยงาน #${facilityId}`}${workGroupId ? ` · กลุ่มงาน #${workGroupId}` : ""}`,
  });
  return { ok: true, message: "ยกเลิกรหัสติดตั้งแล้ว — คำสั่งที่คัดลอกไปก่อนหน้าใช้ติดตั้งเครื่องใหม่ไม่ได้ เครื่องที่ติดตั้งแล้วยังทำงานตามปกติ" };
}
