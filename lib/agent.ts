import "server-only";

import crypto from "node:crypto";

import type { RowDataPacket } from "mysql2/promise";

import { supportsAgentAsset } from "@/lib/asset-policy";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { createAsset, findOrCreateSurvey, updateAsset } from "@/lib/assets";
import { findActiveFacilityWorkGroup, getActiveFacilityWorkGroupForFacility, getFacilityAgentContext, normalizeWorkGroupName } from "@/lib/facility-work-groups";
import { cleanAgentCapabilities, cleanAgentReport, cleanFingerprint, cleanText, type CleanAgentReport } from "@/lib/agent-payload";
import {
  decideAgentUninstall,
  decideAgentUninstallConfirmation,
  type AgentUninstallInstruction,
  type AgentUninstallReason,
} from "@/lib/agent-uninstall";
import { INSTALL_SCOPE_PREFIX, deriveInstallToken, installTokenMatches, installTokenSecret } from "@/lib/agent-install-token";
import { REENROLL_QUIET_DAYS, decideReenroll } from "@/lib/agent-reenroll";
import { executeStatement, selectRows } from "@/lib/mysql";
import { formatThaiDateTime } from "@/lib/date-format";
import { dbDateTime, todayBangkok } from "@/lib/local-date";

type EnrollmentRow = RowDataPacket & {
  id: number;
  facility_id: number;
  facility_name: string;
  work_group_id: number | null;
  work_group_name: string | null;
  enrollment_name: string | null;
  token_hash: string;
  is_active: number;
  expires_at: Date | string | null;
  created_at: Date | string;
  created_by_user_id: number | null;
  last_used_at: Date | string | null;
};

type DeviceRow = RowDataPacket & {
  id: number;
  facility_id: number;
  facility_name: string;
  enrollment_id: number | null;
  linked_asset_id: number | null;
  agent_uuid: string;
  agent_key_hash: string;
  device_fingerprint: string;
  hostname: string | null;
  serial_number: string | null;
  bios_serial: string | null;
  device_type: string | null;
  manufacturer_brand: string | null;
  manufacturer_model: string | null;
  operating_system: string | null;
  operating_system_version: string | null;
  private_ip: string | null;
  mac_address: string | null;
  current_user: string | null;
  cpu_model: string | null;
  ram_mb: number | null;
  disk_total_gb: number | null;
  disk_free_gb: number | null;
  disk_used_gb: number | null;
  location_detail: string | null;
  agent_version: string | null;
  status: string | null;
  is_active: number;
  first_seen_at: Date | string;
  last_seen_at: Date | string | null;
  last_reported_at: Date | string | null;
  raw_payload_json: string | null;
  /** มีเมื่อรัน database/add_agent_health.sql แล้ว */
  health_json?: string | null;
  /** มีเมื่อรัน database/add_agent_link_mode.sql แล้ว: 1 = ผู้ดูแลยกเลิกการผูก ห้ามผูก/สร้างทะเบียนอัตโนมัติ */
  auto_link_disabled?: number | null;
  /** มีเมื่อรัน database/add_agent_uninstall.sql แล้ว */
  uninstall_requested_at?: Date | string | null;
  uninstall_requested_by?: string | null;
  uninstalled_at?: Date | string | null;
  linked_asset_registration_no: string | null;
  linked_asset_name: string | null;
};

type AssetLinkRow = RowDataPacket & {
  id: number;
};

export type AgentEnrollment = {
  id: number;
  facilityId: number;
  facilityName: string;
  workGroupId: number | null;
  workGroupName: string | null;
  enrollmentName: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdByUserId: number | null;
  lastUsedAt: string | null;
};

export type AgentDevice = {
  id: number;
  facilityId: number;
  facilityName: string;
  enrollmentId: number | null;
  linkedAssetId: number | null;
  linkedAssetRegistrationNo: string | null;
  linkedAssetName: string | null;
  agentUuid: string;
  deviceFingerprint: string;
  hostname: string | null;
  serialNumber: string | null;
  biosSerial: string | null;
  deviceType: string | null;
  manufacturerBrand: string | null;
  manufacturerModel: string | null;
  operatingSystem: string | null;
  operatingSystemVersion: string | null;
  privateIp: string | null;
  macAddress: string | null;
  currentUser: string | null;
  cpuModel: string | null;
  ramMb: number | null;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  diskUsedGb: number | null;
  locationDetail: string | null;
  agentVersion: string | null;
  status: string;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string | null;
  lastReportedAt: string | null;
  /** lastReportedAt (หรือ lastSeenAt) ในรูปแบบวันที่ไทย เวลา Asia/Bangkok พร้อมแสดงผล */
  lastReportedLabel: string | null;
  /** ผู้ดูแลยกเลิกการผูกเอง: Agent จะไม่ผูกหรือสร้างทะเบียนให้อัตโนมัติอีก */
  autoLinkDisabled: boolean;
  /** ข้อมูลสุขภาพเครื่องจาก Agent 2.x (JSON ที่ผ่าน cleanAgentHealth แล้ว) */
  healthJson: string | null;
  /** ผู้ดูแลสั่งถอนการติดตั้ง (ISO +07:00) — null เมื่อไม่มีคำสั่งหรือยังไม่ได้รัน add_agent_uninstall.sql */
  uninstallRequestedAt: string | null;
  uninstallRequestedBy: string | null;
  /** Agent ยืนยันว่าถอนการติดตั้งแล้ว (ISO +07:00) */
  uninstalledAt: string | null;
};

export type OfflineAgentDevice = Pick<AgentDevice, "id" | "facilityName" | "agentUuid" | "hostname" | "lastSeenAt">;

export type AgentReportPayload = {
  fingerprint: string;
  hostname?: string | null;
  serialNumber?: string | null;
  biosSerial?: string | null;
  deviceType?: string | null;
  manufacturerBrand?: string | null;
  manufacturerModel?: string | null;
  operatingSystem?: string | null;
  operatingSystemVersion?: string | null;
  privateIp?: string | null;
  macAddress?: string | null;
  currentUser?: string | null;
  cpuModel?: string | null;
  ramMb?: number | null;
  diskTotalGb?: number | null;
  diskFreeGb?: number | null;
  diskUsedGb?: number | null;
  locationDetail?: string | null;
  agentVersion?: string | null;
  status?: string | null;
  collectedAt?: string | null;
  raw?: unknown;
  /** Agent 2.x: ข้อมูลสุขภาพเครื่อง (ดู lib/agent-payload.ts) */
  health?: unknown;
  /** Agent 2.2+: "windows" | "linux" และ ["self-update"] (ดู lib/agent-update.ts) */
  agentPlatform?: string | null;
  capabilities?: unknown;
};

function isDbError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === code;
}

/**
 * DB DATETIME (เวลาไทยตาม NOW() ของ MySQL +07:00) -> ISO พร้อม offset เช่น "2026-11-02T09:30:00+07:00"
 * ระบุ offset ชัดเจน จึงแปลงเวลาถูกทั้งบนเครื่องที่ TZ=UTC (Vercel) และ TZ=Asia/Bangkok (Docker)
 * mysql2 คืน Date ตามเวลาท้องถิ่นของโปรเซส จึงอ่านค่าตามที่เก็บด้วย dbDateTime ห้ามใช้ toISOString
 */
export function agentTimestamp(value: Date | string | null | undefined) {
  const text = dbDateTime(value);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return null;
  return `${text.replace(" ", "T")}+07:00`;
}

const toDateTime = agentTimestamp;

function isMissingColumnError(error: unknown) {
  return isDbError(error, "ER_BAD_FIELD_ERROR");
}

/** อธิบายว่าทำไมทะเบียนที่ผูกไว้ใช้กับ Agent ไม่ได้แล้ว (ย้ายหน่วยงาน/เปลี่ยนประเภท/ถูกลบ) */
export class AgentLinkedAssetError extends Error {
  linkedAssetId: number | null;
  reason: string;
  constructor(linkedAssetId: number | null, reason: string) {
    super("LINKED_ASSET_INVALID");
    this.name = "AgentLinkedAssetError";
    this.linkedAssetId = linkedAssetId;
    this.reason = reason;
  }
}

// information_assets.deleted_at มาจาก migration ของอีกส่วนหนึ่ง ตรวจจาก information_schema แล้ว cache
// ถ้ายังไม่มีคอลัมน์ ตรวจซ้ำทุก 5 นาที (จะเห็นคอลัมน์ทันทีหลังรัน migration โดยไม่ต้องรีสตาร์ท)
let deletedAtProbe: { present: boolean; checkedAt: number } | null = null;
const DELETED_AT_RECHECK_MS = 5 * 60 * 1000;

async function assetsHaveDeletedAt() {
  if (deletedAtProbe && (deletedAtProbe.present || Date.now() - deletedAtProbe.checkedAt < DELETED_AT_RECHECK_MS)) {
    return deletedAtProbe.present;
  }
  let present = false;
  try {
    const rows = await selectRows<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'deleted_at'`
    );
    present = Number(rows[0]?.total ?? 0) > 0;
  } catch {
    present = false;
  }
  deletedAtProbe = { present, checkedAt: Date.now() };
  return present;
}

/** Re-enrolment refused: the fingerprint belongs to an active device that is still reporting. */
export class AgentDeviceAlreadyEnrolledError extends Error {
  readonly code = "DEVICE_ALREADY_ENROLLED";
  constructor(readonly device: { deviceId: number; hostname: string | null; facilityName: string; lastSeenAt: string | null }) {
    super("DEVICE_ALREADY_ENROLLED");
  }
}

export const AGENT_REENROLL_QUIET_DAYS = REENROLL_QUIET_DAYS;

function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(24).toString("base64url")}`;
}

function toEnrollment(row: EnrollmentRow): AgentEnrollment {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    workGroupId: row.work_group_id,
    workGroupName: row.work_group_name,
    enrollmentName: row.enrollment_name ?? "ไม่มีชื่อกำกับ",
    isActive: row.is_active === 1,
    expiresAt: toDateTime(row.expires_at),
    createdAt: toDateTime(row.created_at) ?? "-",
    createdByUserId: row.created_by_user_id,
    lastUsedAt: toDateTime(row.last_used_at),
  };
}

function toDevice(row: DeviceRow): AgentDevice {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    enrollmentId: row.enrollment_id,
    linkedAssetId: row.linked_asset_id,
    linkedAssetRegistrationNo: row.linked_asset_registration_no,
    linkedAssetName: row.linked_asset_name,
    agentUuid: row.agent_uuid,
    deviceFingerprint: row.device_fingerprint,
    hostname: row.hostname,
    serialNumber: row.serial_number,
    biosSerial: row.bios_serial,
    deviceType: row.device_type,
    manufacturerBrand: row.manufacturer_brand,
    manufacturerModel: row.manufacturer_model,
    operatingSystem: row.operating_system,
    operatingSystemVersion: row.operating_system_version,
    privateIp: row.private_ip,
    macAddress: row.mac_address,
    currentUser: row.current_user,
    cpuModel: row.cpu_model,
    ramMb: row.ram_mb,
    diskTotalGb: row.disk_total_gb,
    diskFreeGb: row.disk_free_gb,
    diskUsedGb: row.disk_used_gb,
    locationDetail: row.location_detail,
    agentVersion: row.agent_version,
    status: row.status ?? "online",
    isActive: row.is_active === 1,
    firstSeenAt: toDateTime(row.first_seen_at) ?? "-",
    lastSeenAt: toDateTime(row.last_seen_at),
    lastReportedAt: toDateTime(row.last_reported_at),
    lastReportedLabel: (() => {
      const value = toDateTime(row.last_reported_at) ?? toDateTime(row.last_seen_at);
      return value ? formatThaiDateTime(value) : null;
    })(),
    autoLinkDisabled: Number(row.auto_link_disabled ?? 0) === 1,
    healthJson: row.health_json ?? null,
    uninstallRequestedAt: toDateTime(row.uninstall_requested_at),
    uninstallRequestedBy: row.uninstall_requested_by ?? null,
    uninstalledAt: toDateTime(row.uninstalled_at),
  };
}

function autoRegistrationNo(facilityId: number, deviceId: number) {
  return `AGT-${String(facilityId).padStart(3, "0")}-${String(deviceId).padStart(6, "0")}`;
}

function buildAssetName(payload: AgentReportPayload) {
  const hostname = payload.hostname?.trim();
  const model = payload.manufacturerModel?.trim();
  const os = payload.operatingSystem?.trim();
  if (hostname && model) return `${hostname} · ${model}`;
  if (hostname) return hostname;
  if (model) return model;
  if (os) return `Computer ${os}`;
  return "Computer (ATACS Agent)";
}

type AgentAssetRow = AssetLinkRow & {
  facility_id: number;
  survey_id: number;
  asset_class: string | null;
  asset_category: string;
  device_type: string | null;
  deleted_at?: Date | string | null;
};

function isAgentAssetRow(row: AgentAssetRow) {
  return supportsAgentAsset({ assetClass: row.asset_class, assetCategory: row.asset_category, deviceType: row.device_type });
}

const AGENT_ASSET_RULE = "Agent เชื่อมได้เฉพาะคอมพิวเตอร์หรือเซิร์ฟเวอร์ IT Hardware ในหน่วยงานเดียวกัน";

/** เหตุผลที่ทะเบียนใช้กับ Agent ไม่ได้ หรือ null ถ้าใช้ได้ */
async function agentAssetProblem(assetId: number, facilityId: number): Promise<{ row: AgentAssetRow | null; problem: string | null }> {
  const hasDeletedAt = await assetsHaveDeletedAt();
  const rows = await selectRows<AgentAssetRow>(
    `SELECT a.id, a.survey_id, a.asset_class, a.asset_category, a.device_type, s.facility_id${hasDeletedAt ? ", a.deleted_at" : ""}
     FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
     WHERE a.id = ? LIMIT 1`, [assetId]
  );
  const row = rows[0] ?? null;
  if (!row) return { row, problem: "ไม่พบทะเบียนที่ผูกไว้ (อาจถูกลบ)" };
  if (hasDeletedAt && row.deleted_at) return { row, problem: "ทะเบียนที่ผูกไว้ถูกลบแล้ว" };
  if (Number(row.facility_id) !== Number(facilityId)) return { row, problem: "ทะเบียนที่ผูกไว้ถูกย้ายไปหน่วยงานอื่น" };
  if (!isAgentAssetRow(row)) return { row, problem: "ทะเบียนที่ผูกไว้ไม่ใช่คอมพิวเตอร์/เซิร์ฟเวอร์ IT Hardware แล้ว" };
  return { row, problem: null };
}

async function requireAgentAsset(assetId: number, facilityId: number) {
  const { row, problem } = await agentAssetProblem(assetId, facilityId);
  if (!row || problem) throw new Error(AGENT_ASSET_RULE);
  return row;
}

async function findAssetCandidate(facilityId: number, serialNumber?: string | null, hostname?: string | null) {
  const notDeleted = (await assetsHaveDeletedAt()) ? "\n         AND (a.deleted_at IS NULL)" : "";
  for (const [column, value] of [["serial_number", serialNumber], ["asset_name", hostname]] as const) {
    if (!value?.trim()) continue;
    const rows = await selectRows<AgentAssetRow>(
      `SELECT a.id, a.asset_class, a.asset_category, a.device_type, s.facility_id
       FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE s.facility_id = ? AND a.${column} = ?
         AND COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT'
         AND a.asset_category = 'Hardware'${notDeleted}
         AND NOT EXISTS (SELECT 1 FROM agent_devices ad WHERE ad.linked_asset_id = a.id)
       ORDER BY a.id`, [facilityId, value.trim()]
    );
    const eligible = rows.filter(isAgentAssetRow);
    if (eligible.length > 1) throw new Error("พบทะเบียน IT ที่ตรงกันมากกว่าหนึ่งรายการ กรุณาผูก Agent กับทะเบียนที่ถูกต้อง");
    if (eligible[0]) return eligible[0].id;
  }
  return null;
}

export async function listAgentEnrollments(filter?: { facilityId?: number }): Promise<AgentEnrollment[]> {
  const where = filter?.facilityId ? "WHERE ae.facility_id = ?" : "";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  const rows = await selectRows<EnrollmentRow>(
    `SELECT ae.*, hf.name AS facility_name, fwg.work_group_name
     FROM agent_enrollments ae
     JOIN health_facilities hf ON hf.id = ae.facility_id
     LEFT JOIN facility_work_groups fwg ON fwg.id = ae.work_group_id
     ${where}
     ORDER BY ae.created_at DESC, ae.id DESC`,
    values
  );
  return rows.map(toEnrollment);
}

export async function listAgentDevices(filter?: { facilityId?: number }): Promise<AgentDevice[]> {
  const where = filter?.facilityId ? "WHERE ad.facility_id = ?" : "";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  const rows = await selectRows<DeviceRow>(
    `SELECT ad.*, hf.name AS facility_name,
            a.asset_registration_no AS linked_asset_registration_no,
            a.asset_name AS linked_asset_name
     FROM agent_devices ad
     JOIN health_facilities hf ON hf.id = ad.facility_id
     LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
     ${where}
     ORDER BY ad.last_seen_at DESC, ad.id DESC`,
    values
  );
  return rows.map(toDevice);
}

export async function getAgentDeviceByLinkedAssetId(assetId: number): Promise<AgentDevice | null> {
  if (!Number.isInteger(assetId) || assetId <= 0) return null;

  try {
    const rows = await selectRows<DeviceRow>(
      `SELECT ad.*, hf.name AS facility_name,
              a.asset_registration_no AS linked_asset_registration_no,
              a.asset_name AS linked_asset_name
       FROM agent_devices ad
       JOIN health_facilities hf ON hf.id = ad.facility_id
       LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
       WHERE ad.linked_asset_id = ?
       ORDER BY ad.last_reported_at DESC, ad.last_seen_at DESC, ad.id DESC
       LIMIT 1`,
      [assetId]
    );
    return rows[0] ? toDevice(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function createAgentEnrollment(input: {
  facilityId: number;
  workGroupId?: number | null;
  enrollmentName?: string | null;
  expiresAt?: string | null;
  createdByUserId?: number | null;
}) {
  const plainToken = randomToken("atacs_enroll");
  const tokenHash = hashSecret(plainToken);
  const enrollmentName = input.enrollmentName?.trim() || null;
  const expiresAt = input.expiresAt?.trim() || null;

  await executeStatement(
    `INSERT INTO agent_enrollments (facility_id, work_group_id, enrollment_name, token_hash, expires_at, created_by_user_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [input.facilityId, input.workGroupId ?? null, enrollmentName, tokenHash, expiresAt || null, input.createdByUserId ?? null]
  );

  return plainToken;
}

export async function revokeAgentEnrollment(id: number) {
  await executeStatement("UPDATE agent_enrollments SET is_active = 0 WHERE id = ?", [id]);
}

type InstallScopeRow = RowDataPacket & { id: number; facility_id: number; work_group_id: number | null; token_hash: string };

const INSTALL_SCOPE_LIKE = `${INSTALL_SCOPE_PREFIX}%`;

/**
 * รหัสติดตั้งของหน่วยงาน (+กลุ่มงาน): ใช้แถวเดิมถ้ายังตรวจผ่าน ไม่มีก็สร้างใหม่
 * plaintext ไม่ถูกเก็บ — คำนวณจาก AUTH_SECRET ทุกครั้ง แล้วเก็บเฉพาะ sha256
 */
export async function getOrCreateInstallScopeToken(input: {
  facilityId: number;
  workGroupId: number | null;
  enrollmentName: string;
  createdByUserId?: number | null;
}): Promise<{ token: string; enrollmentId: number; created: boolean; rotated: number }> {
  const secret = installTokenSecret();
  const workGroupId = input.workGroupId ?? null;
  const rows = await selectRows<InstallScopeRow>(
    `SELECT ae.id, ae.facility_id, ae.work_group_id, ae.token_hash
     FROM agent_enrollments ae
     WHERE ae.facility_id = ?
       AND ((? IS NULL AND ae.work_group_id IS NULL) OR ae.work_group_id = ?)
       AND ae.enrollment_name LIKE ?
       AND ae.is_active = 1
       AND ae.expires_at IS NULL
     ORDER BY ae.id ASC`,
    [input.facilityId, workGroupId, workGroupId, INSTALL_SCOPE_LIKE]
  );

  let rotated = 0;
  for (const row of rows) {
    const scope = { id: Number(row.id), facilityId: Number(row.facility_id), workGroupId: row.work_group_id == null ? null : Number(row.work_group_id) };
    if (installTokenMatches(scope, row.token_hash, secret)) {
      return { token: deriveInstallToken(scope, secret), enrollmentId: scope.id, created: false, rotated };
    }
    // AUTH_SECRET เปลี่ยน: คำนวณรหัสเดิมไม่ได้แล้ว ปิดแถวนี้แล้วออกรหัสใหม่
    await executeStatement("UPDATE agent_enrollments SET is_active = 0 WHERE id = ?", [row.id]);
    rotated += 1;
  }

  const result = await executeStatement(
    `INSERT INTO agent_enrollments (facility_id, work_group_id, enrollment_name, token_hash, expires_at, created_by_user_id, is_active)
     VALUES (?, ?, ?, ?, NULL, ?, 1)`,
    [input.facilityId, workGroupId, input.enrollmentName.slice(0, 255), hashSecret(randomToken("atacs_pending")), input.createdByUserId ?? null]
  );
  const id = Number(result.insertId);
  const token = deriveInstallToken({ id, facilityId: input.facilityId, workGroupId }, secret);
  await executeStatement("UPDATE agent_enrollments SET token_hash = ? WHERE id = ?", [hashSecret(token), id]);
  return { token, enrollmentId: id, created: true, rotated };
}

/** ยกเลิกรหัสติดตั้งของหน่วยงาน (+กลุ่มงาน) — คำสั่งที่คัดลอกไปแล้วจะลงทะเบียนเครื่องใหม่ไม่ได้ เครื่องเดิมยังทำงานต่อ */
export async function revokeInstallScopeEnrollments(input: { facilityId: number; workGroupId: number | null }) {
  const workGroupId = input.workGroupId ?? null;
  const result = await executeStatement(
    `UPDATE agent_enrollments SET is_active = 0
     WHERE facility_id = ?
       AND ((? IS NULL AND work_group_id IS NULL) OR work_group_id = ?)
       AND enrollment_name LIKE ?
       AND is_active = 1`,
    [input.facilityId, workGroupId, workGroupId, INSTALL_SCOPE_LIKE]
  );
  return Number(result.affectedRows ?? 0);
}

async function getEnrollmentByToken(token: string) {
  const tokenHash = hashSecret(token.trim());
  const rows = await selectRows<EnrollmentRow>(
    `SELECT ae.*, hf.name AS facility_name, fwg.work_group_name
     FROM agent_enrollments ae
     JOIN health_facilities hf ON hf.id = ae.facility_id
     LEFT JOIN facility_work_groups fwg ON fwg.id = ae.work_group_id
     WHERE ae.token_hash = ?
       AND ae.is_active = 1
       AND (ae.expires_at IS NULL OR ae.expires_at > NOW())
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

async function getEnrollmentById(id: number) {
  const rows = await selectRows<EnrollmentRow>(
    `SELECT ae.*, hf.name AS facility_name, fwg.work_group_name
     FROM agent_enrollments ae
     JOIN health_facilities hf ON hf.id = ae.facility_id
     LEFT JOIN facility_work_groups fwg ON fwg.id = ae.work_group_id
     WHERE ae.id = ?
       AND ae.is_active = 1
       AND (ae.expires_at IS NULL OR ae.expires_at > NOW())
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getReusableInstallEnrollment(input: {
  facilityId: number;
  workGroupId: number | null;
  enrollmentName: string;
}) {
  const rows = await selectRows<EnrollmentRow>(
    `SELECT ae.*, hf.name AS facility_name, fwg.work_group_name
     FROM agent_enrollments ae
     JOIN health_facilities hf ON hf.id = ae.facility_id
     LEFT JOIN facility_work_groups fwg ON fwg.id = ae.work_group_id
     WHERE ae.facility_id = ?
       AND ((? IS NULL AND ae.work_group_id IS NULL) OR ae.work_group_id = ?)
       AND ae.enrollment_name = ?
       AND ae.created_by_user_id IS NULL
       AND ae.expires_at IS NULL
       AND ae.is_active = 1
     ORDER BY ae.id ASC
     LIMIT 1`,
    [input.facilityId, input.workGroupId, input.workGroupId, input.enrollmentName]
  );
  return rows[0] ?? null;
}

async function ensureReusableInstallEnrollment(input: {
  facilityId: number;
  workGroupId: number | null;
  enrollmentName: string;
}) {
  const existing = await getReusableInstallEnrollment(input);
  if (existing) return existing;

  const tokenHash = hashSecret(randomToken("atacs_install"));
  const result = await executeStatement(
    `INSERT INTO agent_enrollments (facility_id, work_group_id, enrollment_name, token_hash, expires_at, created_by_user_id, is_active)
     VALUES (?, ?, ?, ?, NULL, NULL, 1)`,
    [input.facilityId, input.workGroupId, input.enrollmentName, tokenHash]
  );

  const created = await getEnrollmentById(result.insertId);
  if (!created) {
    throw new Error("INSTALL_ENROLLMENT_UNAVAILABLE");
  }
  return created;
}

async function getAgentDeviceByCredentials(agentId: string, agentKey: string) {
  const rows = await selectRows<DeviceRow>(
    `SELECT ad.*, hf.name AS facility_name,
            a.asset_registration_no AS linked_asset_registration_no,
            a.asset_name AS linked_asset_name
     FROM agent_devices ad
     JOIN health_facilities hf ON hf.id = ad.facility_id
     LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
     WHERE ad.agent_uuid = ?
       AND ad.agent_key_hash = ?
       AND ad.is_active = 1
     LIMIT 1`,
    [agentId.trim(), hashSecret(agentKey.trim())]
  );
  return rows[0] ?? null;
}

async function enrollAgentDeviceForEnrollment(input: {
  enrollment: EnrollmentRow;
  fingerprint: string;
  hostname?: string | null;
  agentVersion?: string | null;
}) {
  const fingerprint = cleanFingerprint(input.fingerprint);
  if (!fingerprint) {
    throw new Error("INVALID_FINGERPRINT");
  }
  const hostname = cleanText(input.hostname, 255);
  const agentVersion = cleanText(input.agentVersion, 50);

  const deviceSecret = randomToken("atacs_device");
  const deviceSecretHash = hashSecret(deviceSecret);
  const existing = await selectRows<DeviceRow>(
    `SELECT ad.*, hf.name AS facility_name,
            a.asset_registration_no AS linked_asset_registration_no,
            a.asset_name AS linked_asset_name
     FROM agent_devices ad
     JOIN health_facilities hf ON hf.id = ad.facility_id
     LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
     WHERE ad.facility_id = ? AND ad.device_fingerprint = ?
     LIMIT 1`,
    [input.enrollment.facility_id, fingerprint]
  );

  // Fingerprint takeover protection: an active device that is still reporting can only be spoken for by its
  // own key. The real agent re-uses that key on reinstall, so a fresh enrolment here is a copy/spoof.
  if (existing[0]) {
    const decision = decideReenroll(
      {
        isActive: Number(existing[0].is_active ?? 0) === 1,
        uninstallRequestedAt: existing[0].uninstall_requested_at ?? null,
        uninstalledAt: existing[0].uninstalled_at ?? null,
        lastSeenAt: existing[0].last_seen_at ?? null,
        lastReportedAt: existing[0].last_reported_at ?? null,
      },
      Date.now()
    );
    if (decision === "blocked") {
      throw new AgentDeviceAlreadyEnrolledError({
        deviceId: existing[0].id,
        hostname: existing[0].hostname ?? null,
        facilityName: existing[0].facility_name ?? input.enrollment.facility_name,
        lastSeenAt: existing[0].last_seen_at ? dbDateTime(existing[0].last_seen_at) : null,
      });
    }
  }

  let deviceId = existing[0]?.id ?? 0;
  const agentUuid = existing[0]?.agent_uuid ?? crypto.randomUUID();

  if (existing[0]) {
    await executeStatement(
      `UPDATE agent_devices
       SET enrollment_id = ?, agent_uuid = ?, agent_key_hash = ?, hostname = ?, agent_version = ?, is_active = 1, status = 'online', last_seen_at = NOW()
       WHERE id = ?`,
      [input.enrollment.id, agentUuid, deviceSecretHash, hostname, agentVersion, existing[0].id]
    );
    deviceId = existing[0].id;
    if (existing[0].uninstall_requested_at || existing[0].uninstalled_at) {
      // ติดตั้งใหม่บนเครื่องที่เคยสั่งถอน/ถอนไปแล้ว: ล้างคำสั่งเดิม ไม่ให้รายงานแรกสั่งถอนตัวเองซ้ำ
      await executeStatement(
        "UPDATE agent_devices SET uninstall_requested_at = NULL, uninstall_requested_by = NULL, uninstalled_at = NULL WHERE id = ?",
        [existing[0].id]
      );
    }
  } else {
    const result = await executeStatement(
      `INSERT INTO agent_devices
         (facility_id, enrollment_id, agent_uuid, agent_key_hash, device_fingerprint, hostname, agent_version, status, is_active, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'online', 1, NOW(), NOW())`,
      [
        input.enrollment.facility_id,
        input.enrollment.id,
        agentUuid,
        deviceSecretHash,
        fingerprint,
        hostname,
        agentVersion,
      ]
    );
    deviceId = result.insertId;
  }

  await executeStatement("UPDATE agent_enrollments SET last_used_at = NOW() WHERE id = ?", [input.enrollment.id]);

  return {
    agentId: agentUuid,
    agentKey: deviceSecret,
    facilityId: input.enrollment.facility_id,
    facilityName: input.enrollment.facility_name,
    workGroupId: input.enrollment.work_group_id,
    workGroupName: input.enrollment.work_group_name,
    deviceId,
    wasExisting: Boolean(existing[0]),
    // Re-enrolment issues a new key and the old agent stops working. Report what was there before
    // so an unexpected takeover can be spotted (security alert in /api/agent/enroll).
    previous: existing[0]
      ? {
          hostname: existing[0].hostname ?? null,
          status: existing[0].status ?? null,
          wasActive: Number(existing[0].is_active ?? 0) === 1,
          lastSeenAt: existing[0].last_seen_at ? dbDateTime(existing[0].last_seen_at) : null,
          agentVersion: existing[0].agent_version ?? null,
        }
      : null,
  };
}

export async function enrollAgentDevice(input: {
  enrollmentToken: string;
  fingerprint: string;
  hostname?: string | null;
  agentVersion?: string | null;
}) {
  const enrollment = await getEnrollmentByToken(input.enrollmentToken);
  if (!enrollment) {
    throw new Error("INVALID_ENROLLMENT_TOKEN");
  }

  return enrollAgentDeviceForEnrollment({
    enrollment,
    fingerprint: input.fingerprint,
    hostname: input.hostname,
    agentVersion: input.agentVersion,
  });
}

export async function enrollAgentDeviceWithInstallKey(input: {
  facilityId: number;
  workGroupId?: number | null;
  workGroupName?: string | null;
  fingerprint: string;
  hostname?: string | null;
  agentVersion?: string | null;
}) {
  const facility = await getFacilityAgentContext(input.facilityId);
  if (!facility) {
    throw new Error("INVALID_FACILITY");
  }

  const workGroupName = normalizeWorkGroupName(input.workGroupName ?? "");
  const workGroupId = input.workGroupId && Number.isInteger(input.workGroupId) && input.workGroupId > 0 ? input.workGroupId : null;
  if (facility.requiresWorkGroup && !workGroupId && workGroupName.length < 2) {
    throw new Error("WORK_GROUP_REQUIRED");
  }
  if (workGroupName.length > 150) {
    throw new Error("WORK_GROUP_TOO_LONG");
  }

  const workGroup = facility.requiresWorkGroup
    ? workGroupId
      ? await getActiveFacilityWorkGroupForFacility(facility.id, workGroupId)
      : await findActiveFacilityWorkGroup(facility.id, workGroupName)
    : null;
  if (facility.requiresWorkGroup && !workGroup) {
    throw new Error("WORK_GROUP_UNAVAILABLE");
  }

  const enrollmentName = facility.requiresWorkGroup
    ? `Install Key · ${facility.name} · ${workGroup?.workGroupName ?? workGroupName}`
    : `Install Key · ${facility.name}`;
  const enrollment = await ensureReusableInstallEnrollment({
    facilityId: facility.id,
    workGroupId: workGroup?.id ?? null,
    enrollmentName,
  });

  return enrollAgentDeviceForEnrollment({
    enrollment,
    fingerprint: input.fingerprint,
    hostname: input.hostname,
    agentVersion: input.agentVersion,
  });
}

export async function authenticateAgent(agentId: string, agentKey: string) {
  const device = await getAgentDeviceByCredentials(agentId, agentKey);
  if (!device) {
    throw new Error("INVALID_AGENT_CREDENTIALS");
  }
  return toDevice(device);
}

export async function reportAgentInventory(input: {
  agentId: string;
  agentKey: string;
  payload: AgentReportPayload | unknown;
}) {
  const deviceRow = await getAgentDeviceByCredentials(input.agentId, input.agentKey);
  if (!deviceRow) {
    throw new Error("INVALID_AGENT_CREDENTIALS");
  }

  // SEC-15/SEC-32: ไม่เชื่อค่าจากเครื่องลูกข่าย ทุกช่องผ่านการตรวจชนิด ช่วง และความยาวก่อนบันทึก
  const payload: CleanAgentReport | null = cleanAgentReport(input.payload);
  if (!payload) {
    throw new Error("INVALID_FINGERPRINT");
  }
  const fingerprint = payload.fingerprint;
  const reportedStatus = payload.status;

  const reportedDeviceType = payload.deviceType || "Computer";
  if (!supportsAgentAsset({ assetClass: "IT", assetCategory: "Hardware", deviceType: reportedDeviceType })) {
    throw new Error("ประเภทอุปกรณ์ไม่รองรับ ATACS Agent");
  }

  // เวลาทั้งหมดใช้ NOW() ของฐานข้อมูล (+07:00) — ไม่สร้างเวลาใน JS (toISOString เป็น UTC ทำให้เพี้ยน 7 ชม.)
  const { health, ...inventory } = payload;
  const updateDevice = (deviceFingerprint: string) => executeStatement(
    `UPDATE agent_devices
     SET device_fingerprint = ?,
         hostname = ?,
         serial_number = ?,
         bios_serial = ?,
         device_type = ?,
         manufacturer_brand = ?,
         manufacturer_model = ?,
         operating_system = ?,
         operating_system_version = ?,
         private_ip = ?,
         mac_address = ?,
         \`current_user\` = ?,
         cpu_model = ?,
         ram_mb = ?,
         disk_total_gb = ?,
         disk_free_gb = ?,
         disk_used_gb = ?,
         location_detail = ?,
         agent_version = ?,
         status = ?,
         last_seen_at = NOW(),
         last_reported_at = NOW(),
         raw_payload_json = ?
     WHERE id = ?`,
    [
      deviceFingerprint,
      payload.hostname,
      payload.serialNumber,
      payload.biosSerial,
      payload.deviceType,
      payload.manufacturerBrand,
      payload.manufacturerModel,
      payload.operatingSystem,
      payload.operatingSystemVersion,
      payload.privateIp,
      payload.macAddress,
      payload.currentUser,
      payload.cpuModel,
      payload.ramMb,
      payload.diskTotalGb,
      payload.diskFreeGb,
      payload.diskUsedGb,
      payload.locationDetail,
      payload.agentVersion,
      reportedStatus,
      // เก็บเฉพาะข้อมูลที่ตรวจแล้ว ไม่เก็บ body ดิบ (เดิมรับได้หลาย MB)
      JSON.stringify(inventory),
      deviceRow.id,
    ]
  );
  try {
    await updateDevice(fingerprint);
  } catch (error) {
    // fingerprint ใหม่ชนกับแถวอื่นในหน่วยงานเดียวกัน (เช่น ติดตั้งซ้ำ) — คง fingerprint เดิมไว้
    if (!isDbError(error, "ER_DUP_ENTRY")) throw error;
    await updateDevice(deviceRow.device_fingerprint);
  }
  try {
    // รายงานที่ไม่มีส่วนสุขภาพ (Agent รุ่นเก่า/อ่านไม่ได้) ต้องล้างค่าเดิม ไม่ให้หน้าติดตามแสดงข้อมูลค้าง
    await executeStatement("UPDATE agent_devices SET health_json = ? WHERE id = ?", [health ? JSON.stringify(health) : null, deviceRow.id]);
  } catch (error) {
    // ยังไม่ได้รัน database/add_agent_health.sql: ข้อมูลอื่นบันทึกแล้ว ข้ามเฉพาะส่วนสุขภาพเครื่อง
    if (!isMissingColumnError(error)) throw error;
  }

  const recovered = deviceRow.status === "offline" && reportedStatus !== "offline";
  const baseResult = {
    deviceId: deviceRow.id,
    facilityId: deviceRow.facility_id,
    recovered,
    hostname: payload.hostname?.trim() || deviceRow.hostname,
    facilityName: deviceRow.facility_name,
    agentUuid: deviceRow.agent_uuid,
    uninstall: null as AgentUninstallInstruction | null,
  };

  // ผู้ดูแลสั่งถอนการติดตั้งและ agent ถอนตัวเองได้: ส่งคำสั่งกลับไป ไม่ต้องผูก/สร้าง/แก้ทะเบียนของเครื่องที่กำลังถอน
  // (ไม่ให้ปัญหาทะเบียนที่ผูกไว้ 409 กลบคำสั่งถอนการติดตั้ง)
  const uninstallDecision = decideAgentUninstall({
    isActive: Number(deviceRow.is_active) === 1,
    uninstallRequestedAt: toDateTime(deviceRow.uninstall_requested_at),
    uninstalledAt: toDateTime(deviceRow.uninstalled_at),
    capabilities: cleanAgentCapabilities((input.payload as { capabilities?: unknown } | null)?.capabilities),
  });
  if (uninstallDecision.uninstall) {
    return { ...baseResult, uninstall: uninstallDecision.uninstall, linkedAssetId: deviceRow.linked_asset_id, surveyId: null };
  }

  // G10: บันทึกว่าเครื่องยังออนไลน์ไปแล้วข้างบน จากนั้นจึงตรวจทะเบียนที่ผูกไว้
  // ถ้าทะเบียนถูกย้าย/เปลี่ยนประเภท/ลบ ไม่แตะทะเบียนและแจ้ง 409 ให้ผู้ดูแลผูกใหม่หรือยกเลิกการผูก
  let linkedAsset: AgentAssetRow | null = null;
  let linkedAssetId = deviceRow.linked_asset_id;
  if (linkedAssetId) {
    const { row, problem } = await agentAssetProblem(linkedAssetId, deviceRow.facility_id);
    if (!row || problem) throw new AgentLinkedAssetError(linkedAssetId, problem ?? AGENT_ASSET_RULE);
    linkedAsset = row;
  } else if (Number(deviceRow.auto_link_disabled ?? 0) === 1) {
    // G7: ผู้ดูแลยกเลิกการผูกเอง — เก็บข้อมูลเครื่องอย่างเดียว ไม่ผูกหรือสร้างทะเบียนใหม่ให้อัตโนมัติ
    return { ...baseResult, linkedAssetId: null, surveyId: null };
  } else {
    linkedAssetId = await findAssetCandidate(deviceRow.facility_id, payload.serialNumber, payload.hostname);
    if (linkedAssetId) linkedAsset = await requireAgentAsset(linkedAssetId, deviceRow.facility_id);
  }
  const surveyId = linkedAsset?.survey_id ?? await findOrCreateSurvey(deviceRow.facility_id);

  const commonAssetFields = {
    surveyId,
    assetName: buildAssetName(payload),
    usageDescription: "Auto collected by ATACS Agent",
    ownerName: payload.currentUser?.trim() || undefined,
    assetCategory: "Hardware" as const,
    deviceType: reportedDeviceType,
    operatingSystem: payload.operatingSystem?.trim() || undefined,
    operatingSystemVersion: payload.operatingSystemVersion?.trim() || undefined,
    privateIp: payload.privateIp?.trim() || undefined,
    locationDetail: payload.locationDetail?.trim() || payload.hostname?.trim() || undefined,
    currentStatus: payload.status?.trim() === "offline" ? "Inactive" : "Active",
    updatedBy: `agent:${payload.hostname?.trim() || deviceRow.agent_uuid}`,
    manufacturerBrand: payload.manufacturerBrand?.trim() || undefined,
    manufacturerModel: payload.manufacturerModel?.trim() || undefined,
    manufacturerSpecification: [
      payload.cpuModel?.trim(),
      payload.ramMb ? `RAM ${payload.ramMb} MB` : null,
      payload.diskTotalGb != null ? `Disk total ${payload.diskTotalGb} GB` : null,
      payload.diskUsedGb != null ? `Disk used ${payload.diskUsedGb} GB` : null,
      payload.diskFreeGb != null ? `Disk free ${payload.diskFreeGb} GB` : null,
      payload.macAddress?.trim() ? `MAC ${payload.macAddress.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    serialNumber: payload.serialNumber?.trim() || payload.biosSerial?.trim() || undefined,
    lastUpdatedAt: todayBangkok(),
  };

  const updateExistingAsset = async (assetId: number, surveyIdForAsset: number) => {
    // Disposed/Lost come from an approved request and Broken from staff/inspection/repairs;
    // an Agent report ("the machine is on") must not revert any of them.
    const [statusRow] = await selectRows<RowDataPacket & { current_status: string | null }>(
      "SELECT current_status FROM information_assets WHERE id = ? LIMIT 1",
      [assetId]
    );
    const { currentStatus, ...fieldsWithoutStatus } = { ...commonAssetFields, surveyId: surveyIdForAsset };
    const keepStatus = isTerminalAssetStatus(statusRow?.current_status) || statusRow?.current_status === "Broken";
    await updateAsset(assetId, keepStatus ? fieldsWithoutStatus : { ...fieldsWithoutStatus, currentStatus });
  };

  if (linkedAssetId) {
    await updateExistingAsset(linkedAssetId, surveyId);
  } else {
    const registrationNo = autoRegistrationNo(deviceRow.facility_id, deviceRow.id);
    try {
      const result = await createAsset({ ...commonAssetFields, assetClass: "IT", assetRegistrationNo: registrationNo });
      linkedAssetId = result.insertId;
    } catch (error) {
      // G7: ทะเบียน AGT-xxx ของเครื่องนี้มีอยู่แล้ว (เช่น เคยยกเลิกการผูกก่อนรัน migration) — ใช้ทะเบียนเดิม ไม่ 500
      if (!isDbError(error, "ER_DUP_ENTRY")) throw error;
      const existing = await findAgentRegistrationAsset(surveyId, registrationNo, deviceRow.id, deviceRow.facility_id);
      if (!existing) throw new AgentLinkedAssetError(null, `เลขทะเบียน ${registrationNo} ถูกใช้กับรายการอื่นแล้ว`);
      linkedAssetId = existing.id;
      await updateExistingAsset(existing.id, existing.survey_id);
    }
  }

  await executeStatement(
    `UPDATE agent_devices SET linked_asset_id = ?, status = ?, last_seen_at = NOW(), last_reported_at = NOW() WHERE id = ?`,
    [linkedAssetId, reportedStatus, deviceRow.id]
  );

  return { ...baseResult, linkedAssetId, surveyId };
}

/** ทะเบียน AGT-xxx ที่มีอยู่แล้วของเครื่องนี้ ใช้ซ้ำได้เมื่อยังเป็นคอมพิวเตอร์ IT ในหน่วยงานเดียวกันและไม่ถูกผูกกับเครื่องอื่น */
async function findAgentRegistrationAsset(surveyId: number, registrationNo: string, deviceId: number, facilityId: number) {
  const rows = await selectRows<AgentAssetRow>(
    `SELECT a.id
     FROM information_assets a
     WHERE a.survey_id = ? AND a.asset_registration_no = ?
       AND NOT EXISTS (SELECT 1 FROM agent_devices ad WHERE ad.linked_asset_id = a.id AND ad.id <> ?)
     LIMIT 1`,
    [surveyId, registrationNo, deviceId]
  );
  if (!rows[0]) return null;
  const { row, problem } = await agentAssetProblem(Number(rows[0].id), facilityId);
  return row && !problem ? row : null;
}

export async function linkAgentDeviceToAsset(deviceId: number, assetId: number | null) {
  if (!Number.isSafeInteger(deviceId) || deviceId <= 0 || (assetId !== null && (!Number.isSafeInteger(assetId) || assetId <= 0))) throw new Error("ID ไม่ถูกต้อง");
  const facilityId = await getAgentDeviceFacilityId(deviceId);
  if (!facilityId) throw new Error("ไม่พบ Agent Device");
  if (assetId !== null) await requireAgentAsset(assetId, facilityId);
  // G7: ยกเลิกการผูกโดยผู้ดูแลต้อง "ติด" — ห้ามรายงานถัดไปผูก/สร้างทะเบียนกลับอัตโนมัติ
  // ผูกกับทะเบียนใหม่เมื่อไรก็เปิดการผูกอัตโนมัติคืน
  try {
    await executeStatement(
      `UPDATE agent_devices SET linked_asset_id = ?, auto_link_disabled = ${assetId === null ? 1 : 0} WHERE id = ?`,
      [assetId ?? null, deviceId]
    );
  } catch (error) {
    // ยังไม่ได้รัน database/add_agent_link_mode.sql
    if (!isMissingColumnError(error)) throw error;
    await executeStatement(
      `UPDATE agent_devices SET linked_asset_id = ? WHERE id = ?`,
      [assetId ?? null, deviceId]
    );
  }
}

export async function getAgentDeviceFacilityId(deviceId: number) {
  const rows = await selectRows<RowDataPacket & { facility_id: number }>(
    "SELECT facility_id FROM agent_devices WHERE id = ? LIMIT 1",
    [deviceId]
  );
  return rows[0]?.facility_id ?? null;
}

export async function getAgentEnrollmentFacilityId(enrollmentId: number) {
  const rows = await selectRows<RowDataPacket & { facility_id: number }>(
    "SELECT facility_id FROM agent_enrollments WHERE id = ? LIMIT 1",
    [enrollmentId]
  );
  return rows[0]?.facility_id ?? null;
}

export async function heartbeatAgent(input: { agentId: string; agentKey: string; status?: string | null }) {
  const device = await getAgentDeviceByCredentials(input.agentId, input.agentKey);
  if (!device) {
    throw new Error("INVALID_AGENT_CREDENTIALS");
  }

  const reportedStatus = input.status?.trim() === "offline" ? "offline" : "online";
  await executeStatement(
    `UPDATE agent_devices SET status = ?, last_seen_at = NOW() WHERE id = ?`,
    [reportedStatus, device.id]
  );

  return {
    deviceId: device.id,
    recovered: device.status === "offline" && reportedStatus !== "offline",
    hostname: device.hostname,
    facilityName: device.facility_name,
    agentUuid: device.agent_uuid,
  };
}

export async function findOfflineAgentDevices(thresholdMinutes: number): Promise<OfflineAgentDevice[]> {
  const safeMinutes = Math.max(5, Math.floor(thresholdMinutes));
  // เครื่องที่ถอนการติดตั้งแล้ว/ลบออกจากระบบ (is_active = 0) ไม่ใช่ "ออฟไลน์" — ไม่แจ้งเตือน
  // uninstalled_at กันซ้ำอีกชั้น และตัดออกได้เมื่อยังไม่ได้รัน add_agent_uninstall.sql
  const query = (withUninstall: boolean) => selectRows<DeviceRow>(
    `SELECT ad.*, hf.name AS facility_name,
            a.asset_registration_no AS linked_asset_registration_no,
            a.asset_name AS linked_asset_name
     FROM agent_devices ad
     JOIN health_facilities hf ON hf.id = ad.facility_id
     LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
     WHERE ad.is_active = 1${withUninstall ? "\n       AND ad.uninstalled_at IS NULL" : ""}
       AND (ad.last_seen_at IS NULL OR ad.last_seen_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
     ORDER BY ad.last_seen_at ASC, ad.id ASC`,
    [safeMinutes]
  );
  let withUninstall = true;
  let rows: DeviceRow[];
  try {
    rows = await query(true);
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    withUninstall = false;
    rows = await query(false);
  }

  if (rows.length > 0) {
    await executeStatement(
      `UPDATE agent_devices
       SET status = 'offline'
       WHERE is_active = 1${withUninstall ? "\n         AND uninstalled_at IS NULL" : ""}
         AND (last_seen_at IS NULL OR last_seen_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
      [safeMinutes]
    );
  }

  return rows.map((row) => ({
    id: row.id,
    facilityName: row.facility_name,
    agentUuid: row.agent_uuid,
    hostname: row.hostname,
    lastSeenAt: toDateTime(row.last_seen_at),
  }));
}

/** ยังไม่ได้รัน database/add_agent_uninstall.sql */
export class AgentUninstallMigrationError extends Error {
  constructor() {
    super("AGENT_UNINSTALL_MIGRATION_REQUIRED");
    this.name = "AgentUninstallMigrationError";
  }
}

/** กุญแจของเครื่องที่ถอนการติดตั้งแล้ว: ใช้ส่งรายงานไม่ได้อีก แต่ /api/agent/uninstalled/ ยังจำคำยืนยันซ้ำได้ (idempotent) */
function uninstalledKeyHash(agentKey: string) {
  return hashSecret(`uninstalled:${hashSecret(agentKey.trim())}`);
}

export async function getAgentDeviceById(deviceId: number): Promise<AgentDevice | null> {
  if (!Number.isSafeInteger(deviceId) || deviceId <= 0) return null;
  const rows = await selectRows<DeviceRow>(
    `SELECT ad.*, hf.name AS facility_name,
            a.asset_registration_no AS linked_asset_registration_no,
            a.asset_name AS linked_asset_name
     FROM agent_devices ad
     JOIN health_facilities hf ON hf.id = ad.facility_id
     LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
     WHERE ad.id = ?
     LIMIT 1`,
    [deviceId]
  );
  return rows[0] ? toDevice(rows[0]) : null;
}

type UninstallStateRow = RowDataPacket & {
  id: number;
  is_active: number;
  uninstall_requested_at: Date | string | null;
  uninstalled_at: Date | string | null;
};

async function readUninstallState(deviceId: number) {
  try {
    const rows = await selectRows<UninstallStateRow>(
      "SELECT id, is_active, uninstall_requested_at, uninstalled_at FROM agent_devices WHERE id = ? LIMIT 1",
      [deviceId]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingColumnError(error)) throw new AgentUninstallMigrationError();
    throw error;
  }
}

/** ผู้ดูแลสั่งถอนการติดตั้ง: agent 2.2.0+ ถอนตัวเองในรอบรายงานถัดไป */
export async function requestAgentUninstall(deviceId: number, requestedBy: string): Promise<"requested" | "already-pending" | "inactive" | "not-found"> {
  const row = await readUninstallState(deviceId);
  if (!row) return "not-found";
  if (Number(row.is_active) !== 1 || row.uninstalled_at) return "inactive";
  if (row.uninstall_requested_at) return "already-pending";
  const result = await executeStatement(
    `UPDATE agent_devices SET uninstall_requested_at = NOW(), uninstall_requested_by = ?
     WHERE id = ? AND is_active = 1 AND uninstalled_at IS NULL AND uninstall_requested_at IS NULL`,
    [requestedBy.slice(0, 255), deviceId]
  );
  return Number(result.affectedRows ?? 0) > 0 ? "requested" : "already-pending";
}

/** ยกเลิกคำสั่งที่ยังไม่ถูกทำ (เครื่องยังไม่ยืนยันว่าถอนแล้ว) */
export async function cancelAgentUninstall(deviceId: number): Promise<"cancelled" | "not-pending" | "not-found"> {
  const row = await readUninstallState(deviceId);
  if (!row) return "not-found";
  if (!row.uninstall_requested_at || row.uninstalled_at) return "not-pending";
  const result = await executeStatement(
    `UPDATE agent_devices SET uninstall_requested_at = NULL, uninstall_requested_by = NULL
     WHERE id = ? AND uninstalled_at IS NULL AND uninstall_requested_at IS NOT NULL`,
    [deviceId]
  );
  return Number(result.affectedRows ?? 0) > 0 ? "cancelled" : "not-pending";
}

/**
 * ลบออกจากระบบ (retire): ยกเลิกกุญแจของเครื่อง (รายงานถัดไปได้ 401) และปิดใช้งาน เก็บประวัติ/ทะเบียนไว้
 * ไม่แตะตัวเครื่อง ไม่ต้องใช้ migration ใหม่ ถ้าเครื่องกลับมาติดตั้งใหม่ด้วย token/คีย์จะได้แถวเดิมคืน
 */
export async function retireAgentDevice(deviceId: number): Promise<"retired" | "already-inactive"> {
  const result = await executeStatement(
    `UPDATE agent_devices SET is_active = 0, status = 'offline', agent_key_hash = ?
     WHERE id = ? AND is_active = 1`,
    [hashSecret(randomToken("atacs_retired")), deviceId]
  );
  return Number(result.affectedRows ?? 0) > 0 ? "retired" : "already-inactive";
}

/** ใช้ตอนรายงานได้ 401: เครื่องนี้ถูกถอน/ลบออกจากระบบไปแล้วหรือไม่ (ไม่ต้องแจ้งเตือนความปลอดภัยซ้ำทุกรอบ) */
export async function isRetiredAgentUuid(agentId: string) {
  if (!agentId.trim()) return false;
  try {
    const rows = await selectRows<RowDataPacket & { is_active: number }>(
      "SELECT is_active FROM agent_devices WHERE agent_uuid = ? LIMIT 1",
      [agentId.trim()]
    );
    return rows[0] ? Number(rows[0].is_active) !== 1 : false;
  } catch {
    return false;
  }
}

export type AgentUninstalledResult =
  | { outcome: "invalid" }
  | { outcome: "not-requested"; deviceId: number }
  | { outcome: "already"; deviceId: number }
  | {
      outcome: "confirmed";
      deviceId: number;
      hostname: string | null;
      facilityName: string;
      agentUuid: string;
      agentVersion: string | null;
      requestedAt: string | null;
      requestedBy: string | null;
      reason: AgentUninstallReason;
    };

/**
 * Agent ยืนยันว่ากำลังถอนการติดตั้งตัวเอง (POST /api/agent/uninstalled/)
 * บันทึก uninstalled_at, ปิดใช้งาน และเปลี่ยนกุญแจเป็นค่าที่ใช้ส่งรายงานไม่ได้อีก
 * เรียกซ้ำด้วยกุญแจเดิม (คำตอบรอบแรกหายระหว่างทาง) ได้ผล "already" ไม่ใช่ 401
 */
export async function confirmAgentUninstalled(input: { agentId: string; agentKey: string; reason: AgentUninstallReason }): Promise<AgentUninstalledResult> {
  const agentId = input.agentId.trim();
  const agentKey = input.agentKey.trim();
  if (!agentId || !agentKey) return { outcome: "invalid" };

  const device = await getAgentDeviceByCredentials(agentId, agentKey);
  if (device) {
    const decision = decideAgentUninstallConfirmation(
      {
        isActive: Number(device.is_active) === 1,
        uninstallRequestedAt: toDateTime(device.uninstall_requested_at),
        uninstalledAt: toDateTime(device.uninstalled_at),
      },
      input.reason
    );
    if (decision === "not-requested") return { outcome: "not-requested", deviceId: device.id };
    if (decision === "confirm") {
      const values = [uninstalledKeyHash(agentKey), device.id, hashSecret(agentKey)];
      let result;
      try {
        result = await executeStatement(
          `UPDATE agent_devices SET is_active = 0, status = 'offline', agent_key_hash = ?, uninstalled_at = NOW()
           WHERE id = ? AND agent_key_hash = ?`,
          values
        );
      } catch (error) {
        // ยังไม่ได้รัน add_agent_uninstall.sql (มาได้เฉพาะสคริปต์ถอนด้วยมือ): ยกเลิกกุญแจและปิดใช้งานเหมือน retire
        if (!isMissingColumnError(error)) throw error;
        result = await executeStatement(
          `UPDATE agent_devices SET is_active = 0, status = 'offline', agent_key_hash = ?
           WHERE id = ? AND agent_key_hash = ?`,
          values
        );
      }
      if (Number(result.affectedRows ?? 0) === 0) return { outcome: "already", deviceId: device.id };
      return {
        outcome: "confirmed",
        deviceId: device.id,
        hostname: device.hostname,
        facilityName: device.facility_name,
        agentUuid: device.agent_uuid,
        agentVersion: device.agent_version,
        requestedAt: toDateTime(device.uninstall_requested_at),
        requestedBy: device.uninstall_requested_by ?? null,
        reason: input.reason,
      };
    }
  }

  const previous = await selectRows<RowDataPacket & { id: number }>(
    "SELECT id FROM agent_devices WHERE agent_uuid = ? AND agent_key_hash = ? AND is_active = 0 LIMIT 1",
    [agentId, uninstalledKeyHash(agentKey)]
  );
  if (previous[0]) return { outcome: "already", deviceId: previous[0].id };
  return { outcome: "invalid" };
}
