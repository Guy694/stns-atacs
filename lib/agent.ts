import "server-only";

import crypto from "node:crypto";

import type { RowDataPacket } from "mysql2/promise";

import { supportsAgentAsset } from "@/lib/asset-policy";
import { createAsset, findOrCreateSurvey, updateAsset } from "@/lib/assets";
import { findActiveFacilityWorkGroup, getActiveFacilityWorkGroupForFacility, getFacilityAgentContext, normalizeWorkGroupName } from "@/lib/facility-work-groups";
import { executeStatement, selectRows } from "@/lib/mysql";

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
};

function toDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  return String(value).replace("T", " ").slice(0, 19);
}

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
  };
}

function normalizeFingerprint(value: string) {
  return value.trim().toLowerCase();
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
};

function isAgentAssetRow(row: AgentAssetRow) {
  return supportsAgentAsset({ assetClass: row.asset_class, assetCategory: row.asset_category, deviceType: row.device_type });
}

async function requireAgentAsset(assetId: number, facilityId: number) {
  const rows = await selectRows<AgentAssetRow>(
    `SELECT a.id, a.survey_id, a.asset_class, a.asset_category, a.device_type, s.facility_id
     FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
     WHERE a.id = ? LIMIT 1`, [assetId]
  );
  if (!rows[0] || Number(rows[0].facility_id) !== Number(facilityId) || !isAgentAssetRow(rows[0])) {
    throw new Error("Agent เชื่อมได้เฉพาะคอมพิวเตอร์หรือเซิร์ฟเวอร์ IT Hardware ในหน่วยงานเดียวกัน");
  }
  return rows[0];
}

async function findAssetCandidate(facilityId: number, serialNumber?: string | null, hostname?: string | null) {
  for (const [column, value] of [["serial_number", serialNumber], ["asset_name", hostname]] as const) {
    if (!value?.trim()) continue;
    const rows = await selectRows<AgentAssetRow>(
      `SELECT a.id, a.asset_class, a.asset_category, a.device_type, s.facility_id
       FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE s.facility_id = ? AND a.${column} = ?
         AND COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT'
         AND a.asset_category = 'Hardware'
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
  const fingerprint = normalizeFingerprint(input.fingerprint);
  if (!fingerprint) {
    throw new Error("INVALID_FINGERPRINT");
  }

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

  let deviceId = existing[0]?.id ?? 0;
  const agentUuid = existing[0]?.agent_uuid ?? crypto.randomUUID();

  if (existing[0]) {
    await executeStatement(
      `UPDATE agent_devices
       SET enrollment_id = ?, agent_uuid = ?, agent_key_hash = ?, hostname = ?, agent_version = ?, is_active = 1, status = 'online', last_seen_at = NOW()
       WHERE id = ?`,
      [input.enrollment.id, agentUuid, deviceSecretHash, input.hostname?.trim() || null, input.agentVersion?.trim() || null, existing[0].id]
    );
    deviceId = existing[0].id;
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
        input.hostname?.trim() || null,
        input.agentVersion?.trim() || null,
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
  payload: AgentReportPayload;
}) {
  const deviceRow = await getAgentDeviceByCredentials(input.agentId, input.agentKey);
  if (!deviceRow) {
    throw new Error("INVALID_AGENT_CREDENTIALS");
  }

  const payload = input.payload;
  const fingerprint = normalizeFingerprint(payload.fingerprint);
  const reportedStatus = payload.status?.trim() || "online";
  if (!fingerprint) {
    throw new Error("INVALID_FINGERPRINT");
  }

  let linkedAsset = deviceRow.linked_asset_id ? await requireAgentAsset(deviceRow.linked_asset_id, deviceRow.facility_id) : null;
  const reportedDeviceType = payload.deviceType?.trim() || "Computer";
  if (!supportsAgentAsset({ assetClass: "IT", assetCategory: "Hardware", deviceType: reportedDeviceType })) {
    throw new Error("ประเภทอุปกรณ์ไม่รองรับ ATACS Agent");
  }

  const lastReportedAt = payload.collectedAt?.trim() || new Date().toISOString().slice(0, 19).replace("T", " ");
  await executeStatement(
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
         last_reported_at = ?,
         raw_payload_json = ?
     WHERE id = ?`,
    [
      fingerprint,
      payload.hostname?.trim() || null,
      payload.serialNumber?.trim() || null,
      payload.biosSerial?.trim() || null,
      payload.deviceType?.trim() || null,
      payload.manufacturerBrand?.trim() || null,
      payload.manufacturerModel?.trim() || null,
      payload.operatingSystem?.trim() || null,
      payload.operatingSystemVersion?.trim() || null,
      payload.privateIp?.trim() || null,
      payload.macAddress?.trim() || null,
      payload.currentUser?.trim() || null,
      payload.cpuModel?.trim() || null,
      payload.ramMb ?? null,
      payload.diskTotalGb ?? null,
      payload.diskFreeGb ?? null,
      payload.diskUsedGb ?? null,
      payload.locationDetail?.trim() || null,
      payload.agentVersion?.trim() || null,
      reportedStatus,
      lastReportedAt,
      JSON.stringify(payload.raw ?? payload),
      deviceRow.id,
    ]
  );

  let linkedAssetId = deviceRow.linked_asset_id;
  if (!linkedAssetId) {
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
    lastUpdatedAt: new Date().toISOString().slice(0, 10),
  };

  if (linkedAssetId) {
    await updateAsset(linkedAssetId, commonAssetFields);
  } else {
    const result = await createAsset({
      ...commonAssetFields,
      assetClass: "IT",
      assetRegistrationNo: autoRegistrationNo(deviceRow.facility_id, deviceRow.id),
    });
    linkedAssetId = result.insertId;
  }

  await executeStatement(
    `UPDATE agent_devices SET linked_asset_id = ?, status = ?, last_seen_at = NOW(), last_reported_at = ? WHERE id = ?`,
    [linkedAssetId, reportedStatus, lastReportedAt, deviceRow.id]
  );

  return {
    deviceId: deviceRow.id,
    linkedAssetId,
    surveyId,
    recovered: deviceRow.status === "offline" && reportedStatus !== "offline",
    hostname: payload.hostname?.trim() || deviceRow.hostname,
    facilityName: deviceRow.facility_name,
    agentUuid: deviceRow.agent_uuid,
  };
}

export async function linkAgentDeviceToAsset(deviceId: number, assetId: number | null) {
  if (!Number.isSafeInteger(deviceId) || deviceId <= 0 || (assetId !== null && (!Number.isSafeInteger(assetId) || assetId <= 0))) throw new Error("ID ไม่ถูกต้อง");
  const facilityId = await getAgentDeviceFacilityId(deviceId);
  if (!facilityId) throw new Error("ไม่พบ Agent Device");
  if (assetId !== null) await requireAgentAsset(assetId, facilityId);
  await executeStatement(
    `UPDATE agent_devices SET linked_asset_id = ? WHERE id = ?`,
    [assetId ?? null, deviceId]
  );
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

  const reportedStatus = input.status?.trim() || "online";
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
  const rows = await selectRows<DeviceRow>(
    `SELECT ad.*, hf.name AS facility_name,
            a.asset_registration_no AS linked_asset_registration_no,
            a.asset_name AS linked_asset_name
     FROM agent_devices ad
     JOIN health_facilities hf ON hf.id = ad.facility_id
     LEFT JOIN information_assets a ON a.id = ad.linked_asset_id
     WHERE ad.is_active = 1
       AND (ad.last_seen_at IS NULL OR ad.last_seen_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
     ORDER BY ad.last_seen_at ASC, ad.id ASC`,
    [safeMinutes]
  );

  if (rows.length > 0) {
    await executeStatement(
      `UPDATE agent_devices
       SET status = 'offline'
       WHERE is_active = 1
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
