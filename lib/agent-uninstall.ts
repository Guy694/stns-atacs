/**
 * ถอนการติดตั้ง ATACS Agent จากระยะไกล (Agent 2.2.0 ขึ้นไป)
 *
 * ผู้ดูแลระบบส่วนกลางสั่ง "ถอนการติดตั้ง" -> agent_devices.uninstall_requested_at
 * รายงานรอบถัดไป (ทุก 4 ชม. หรือเปิดเครื่อง) ของ agent ที่ประกาศ capabilities: ["self-uninstall"]
 * ได้รับ `uninstall: { requestedAt }` ในคำตอบของ /api/agent/report
 * agent ยืนยันที่ POST /api/agent/uninstalled/ ก่อน (เซิร์ฟเวอร์บันทึก uninstalled_at และยกเลิกกุญแจของเครื่อง)
 * ยืนยันไม่สำเร็จจะไม่ลบอะไรในรอบนั้น แล้วจึงลบ Scheduled Task / systemd timer, config และโฟลเดอร์ติดตั้ง
 *
 * "ลบออกจากระบบ" (retire) = ยกเลิกกุญแจ + ปิดใช้งาน เก็บประวัติไว้ ไม่แตะตัวเครื่อง (ใช้กับเครื่องที่ไม่กลับมาแล้ว)
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูลและไม่ใช้ node API จึงใช้ได้ทั้งฝั่งเซิร์ฟเวอร์ หน้าเว็บ และทดสอบได้โดยตรง
 */

import { cleanAgentCapabilities, compareVersions } from "@/lib/agent-payload";

export const AGENT_SELF_UNINSTALL_CAPABILITY = "self-uninstall";
/** รุ่นแรกที่ถอนการติดตั้งตัวเองได้: รุ่นก่อนหน้าต้องถอนด้วยมือ หรือ "ลบออกจากระบบ" */
export const AGENT_SELF_UNINSTALL_MIN_VERSION = "2.2.0";
/** body ของ /api/agent/uninstalled/ มีแค่ reason + requestedAt */
export const AGENT_UNINSTALLED_MAX_BYTES = 4 * 1024;
export const AGENT_UNINSTALL_MIGRATION_FILE = "database/add_agent_uninstall.sql";
export const AGENT_UNINSTALL_MIGRATION_MESSAGE =
  `ยังไม่ได้รัน ${AGENT_UNINSTALL_MIGRATION_FILE} — ให้ผู้ดูแลฐานข้อมูลรันไฟล์นี้ก่อน จึงจะสั่งถอนการติดตั้ง Agent จากระยะไกลได้ (ระหว่างนี้ใช้ “ลบออกจากระบบ” หรือคำสั่งถอนด้วยมือได้)`;

export type AgentLifecycleState = "active" | "uninstall-pending" | "uninstalled" | "retired";

export const AGENT_LIFECYCLE_LABELS: Record<AgentLifecycleState, string> = {
  active: "ใช้งานอยู่",
  "uninstall-pending": "รอถอนการติดตั้ง",
  uninstalled: "ถอนการติดตั้งแล้ว",
  retired: "ลบออกจากระบบแล้ว",
};

export type AgentLifecycleInput = {
  isActive: boolean;
  uninstallRequestedAt?: string | null;
  uninstalledAt?: string | null;
};

export function agentLifecycleState(device: AgentLifecycleInput): AgentLifecycleState {
  if (device.uninstalledAt) return "uninstalled";
  if (!device.isActive) return "retired";
  if (device.uninstallRequestedAt) return "uninstall-pending";
  return "active";
}

/** เครื่องที่ยังนับในยอดออนไลน์/ออฟไลน์ แจ้งเตือนออฟไลน์ และแดชบอร์ด (รวมเครื่องที่รอถอน เพราะยังติดตั้งอยู่) */
export function isAgentDeviceInService(device: AgentLifecycleInput) {
  const state = agentLifecycleState(device);
  return state === "active" || state === "uninstall-pending";
}

/** ใช้ในหน้าจอ: เดาจากรุ่นที่รายงานล่าสุด (เซิร์ฟเวอร์ตัดสินจริงจาก capabilities ในรายงาน) */
export function agentVersionSupportsSelfUninstall(agentVersion: string | null | undefined) {
  const text = agentVersion?.trim() ?? "";
  if (!/^\d+\.\d+(\.\d+)?/.test(text)) return false;
  return compareVersions(text, AGENT_SELF_UNINSTALL_MIN_VERSION) >= 0;
}

export type AgentUninstallInstruction = { requestedAt: string };

export type AgentUninstallDecision =
  | { uninstall: AgentUninstallInstruction; reason: "requested" }
  | { uninstall: null; reason: "not-requested" | "inactive" | "no-capability" };

/** แนบคำสั่งถอนการติดตั้งไปกับคำตอบของ /api/agent/report หรือไม่ */
export function decideAgentUninstall(input: AgentLifecycleInput & { capabilities: unknown }): AgentUninstallDecision {
  if (!input.isActive || input.uninstalledAt) return { uninstall: null, reason: "inactive" };
  if (!input.uninstallRequestedAt) return { uninstall: null, reason: "not-requested" };
  // agent รุ่นเก่าไม่รู้จักคำสั่งนี้: คำสั่งค้างไว้ หน้าจอแสดงวิธีถอนด้วยมือ
  if (!cleanAgentCapabilities(input.capabilities).includes(AGENT_SELF_UNINSTALL_CAPABILITY)) {
    return { uninstall: null, reason: "no-capability" };
  }
  return { uninstall: { requestedAt: input.uninstallRequestedAt }, reason: "requested" };
}

/** remote = ทำตามคำสั่งจากเซิร์ฟเวอร์ (ต้องมีคำสั่งค้างอยู่), manual = สคริปต์ถอนด้วยมือแจ้งเซิร์ฟเวอร์ */
export type AgentUninstallReason = "remote" | "manual";

export function parseAgentUninstalledBody(value: unknown): { reason: AgentUninstallReason } {
  const reason = typeof value === "object" && value !== null ? (value as { reason?: unknown }).reason : undefined;
  return { reason: reason === "manual" ? "manual" : "remote" };
}

export type AgentUninstallConfirmation = "confirm" | "not-requested" | "inactive";

/**
 * คำยืนยันจากเครื่องที่กุญแจยังใช้ได้:
 * - remote ต้องมีคำสั่งค้างอยู่ (ผู้ดูแลอาจยกเลิกคำสั่งไปแล้วระหว่างรอบรายงาน -> 409 แล้ว agent ไม่ลบอะไร)
 * - manual (ผู้ดูแลรันสคริปต์ถอนที่เครื่องเอง) รับได้เสมอ
 */
export function decideAgentUninstallConfirmation(device: AgentLifecycleInput, reason: AgentUninstallReason): AgentUninstallConfirmation {
  if (!device.isActive || device.uninstalledAt) return "inactive";
  if (reason === "remote" && !device.uninstallRequestedAt) return "not-requested";
  return "confirm";
}
