import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { facilitySurveys as fallbackSurveys, type AssetRecord } from "@/app/atacs-data";
import { executeStatement, selectRows } from "@/lib/mysql";

// ── DB Row types ───────────────────────────────────────────────────────────

type AssetRow = RowDataPacket & {
  id: number;
  survey_id: number;
  facility_id: number;
  facility_name: string | null;
  district_name: string | null;
  row_no: number | null;
  asset_registration_no: string | null;
  asset_name: string;
  usage_description: string | null;
  owner_name: string | null;
  asset_category: "Hardware" | "Software" | null;
  asset_group: string | null;
  device_type: string | null;
  operating_system: string | null;
  operating_system_version: string | null;
  private_ip: string | null;
  public_ip: string | null;
  location_detail: string | null;
  installed_at: Date | string | null;
  last_updated_at: Date | string | null;
  current_status: string | null;
  updated_by: string | null;
  manufacturer_brand: string | null;
  manufacturer_model: string | null;
  manufacturer_specification: string | null;
  serial_number: string | null;
  purchase_price: number | null;
  purchase_date: Date | string | null;
  purchase_order_no: string | null;
  maintenance_start_date: Date | string | null;
  maintenance_end_date: Date | string | null;
};

type SurveyRow = RowDataPacket & {
  id: number;
  facility_id: number;
  facility_name: string | null;
  district_name: string | null;
  survey_title: string | null;
  survey_date: Date | string | null;
  personnel_count: number | null;
};

// ── Normalise helpers ──────────────────────────────────────────────────────

function toDateOnly(v: Date | string | null | undefined) {
  if (!v) return "";
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
}

function normalizeStatus(v: string | null): AssetRecord["currentStatus"] {
  const s = (v ?? "").trim().toLowerCase();
  if (["broken", "ชำรุด", "เสีย"].includes(s)) return "Broken";
  if (["inactive", "in-active", "ไม่ใช้งาน"].includes(s)) return "Inactive";
  return "Active";
}

function normalizeGroup(v: string | null): AssetRecord["assetGroup"] {
  const s = (v ?? "").trim().toLowerCase();
  if (["software", "system", "application", "app", "os"].includes(s)) return "Software";
  return "Hardware";
}

function rowToAsset(row: AssetRow) {
  return {
    id: row.id,
    surveyId: row.survey_id,
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "",
    districtName: row.district_name ?? "",
    assetRegistrationNo: row.asset_registration_no ?? "",
    assetName: row.asset_name,
    usageDescription: row.usage_description ?? "",
    ownerName: row.owner_name ?? "",
    assetGroup: row.asset_category ?? normalizeGroup(row.asset_group),
    deviceType: row.device_type ?? "",
    operatingSystem: row.operating_system ?? "",
    privateIp: row.private_ip ?? "",
    publicIp: row.public_ip ?? undefined,
    locationDetail: row.location_detail ?? "",
    currentStatus: normalizeStatus(row.current_status),
    updatedBy: row.updated_by ?? "",
    updatedAt: toDateOnly(row.last_updated_at),
    maintenanceStartDate: toDateOnly(row.maintenance_start_date),
    maintenanceEndDate: toDateOnly(row.maintenance_end_date),
    manufacturerBrand: row.manufacturer_brand ?? "",
    serialNumber: row.serial_number ?? "",
    purchasePrice: row.purchase_price ?? null,
    purchaseDate: toDateOnly(row.purchase_date),
    purchaseOrderNo: row.purchase_order_no ?? "",
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export type AssetWithFacility = ReturnType<typeof rowToAsset>;

export type AssetInput = {
  surveyId: number;
  assetRegistrationNo: string | null;
  assetName: string;
  usageDescription?: string;
  ownerName?: string;
  assetCategory: "Hardware" | "Software";
  deviceType?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  privateIp?: string;
  publicIp?: string;
  locationDetail?: string;
  currentStatus?: string;
  updatedBy?: string;
  manufacturerBrand?: string;
  manufacturerModel?: string;
  manufacturerSpecification?: string;
  serialNumber?: string;
  purchasePrice?: number | null;
  purchaseDate?: string;
  purchaseOrderNo?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  installedAt?: string;
  lastUpdatedAt?: string;
  rowNo?: number;
};

export type AssetListFilter = {
  facilityId?: number;
  workGroupId?: number;
  status?: string;
  search?: string;
  district?: string;
  assetGroup?: "Hardware" | "Software";
  deviceType?: string;
  maExpiringDays?: number;
  sort?: "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "ma_soon";
  limit?: number;
  offset?: number;
};

const ASSET_FROM_SQL = `
  FROM information_assets a
  JOIN information_asset_surveys s ON s.id = a.survey_id
  JOIN health_facilities hf        ON hf.id = s.facility_id
`;

const ASSET_JOIN_SQL = `
  SELECT
    a.*,
    s.facility_id,
    hf.name          AS facility_name,
    hf.district_name
  ${ASSET_FROM_SQL}
`;

function buildAssetFilter(filter?: AssetListFilter) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filter?.facilityId) {
    conditions.push("s.facility_id = ?");
    values.push(filter.facilityId);
  }
  if (filter?.workGroupId) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM agent_devices ad_wg
        JOIN agent_enrollments ae_wg ON ae_wg.id = ad_wg.enrollment_id
        WHERE ad_wg.linked_asset_id = a.id
          AND ae_wg.work_group_id = ?
      )`
    );
    values.push(filter.workGroupId);
  }
  if (filter?.status) {
    conditions.push("a.current_status = ?");
    values.push(filter.status);
  }
  if (filter?.search) {
    conditions.push("(a.asset_name LIKE ? OR a.asset_registration_no LIKE ? OR a.device_type LIKE ? OR a.serial_number LIKE ?)");
    const like = `%${filter.search}%`;
    values.push(like, like, like, like);
  }
  if (filter?.district) {
    conditions.push("hf.district_name = ?");
    values.push(filter.district);
  }
  if (filter?.assetGroup) {
    conditions.push("a.asset_category = ?");
    values.push(filter.assetGroup);
  }
  if (filter?.deviceType) {
    conditions.push("a.device_type = ?");
    values.push(filter.deviceType);
  }
  if (filter?.maExpiringDays && Number.isFinite(filter.maExpiringDays) && filter.maExpiringDays > 0) {
    conditions.push("a.maintenance_end_date IS NOT NULL AND DATEDIFF(a.maintenance_end_date, CURDATE()) BETWEEN 0 AND ?");
    values.push(filter.maExpiringDays);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

function sortFallbackAssets(assets: AssetWithFacility[], sort?: AssetListFilter["sort"]) {
  const sorted = [...assets];
  sorted.sort((a, b) => {
    if (sort === "updated_desc") return b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id;
    if (sort === "updated_asc") return a.updatedAt.localeCompare(b.updatedAt) || a.id - b.id;
    if (sort === "name_asc") return a.assetName.localeCompare(b.assetName) || a.id - b.id;
    if (sort === "name_desc") return b.assetName.localeCompare(a.assetName) || b.id - a.id;
    if (sort === "ma_soon") return (a.maintenanceEndDate || "9999-12-31").localeCompare(b.maintenanceEndDate || "9999-12-31") || a.id - b.id;
    return (
      a.districtName.localeCompare(b.districtName) ||
      a.facilityName.localeCompare(b.facilityName) ||
      a.id - b.id
    );
  });
  return sorted;
}

function filterFallbackAssets(filter?: AssetListFilter) {
  let assets = fallbackSurveys.flatMap((s) =>
    s.assets.map((a) => ({
      ...a,
      surveyId: 0,
      facilityId: s.facilityId,
      facilityName: s.facilityName,
      districtName: s.districtName,
      publicIp: a.publicIp ?? undefined,
      purchasePrice: a.purchasePrice ?? null,
      purchaseDate: a.purchaseDate ?? "",
      purchaseOrderNo: a.purchaseOrderNo ?? "",
      maintenanceStartDate: "",
    }))
  );

  if (filter?.facilityId) assets = assets.filter((asset) => asset.facilityId === filter.facilityId);
  if (filter?.workGroupId) assets = [];
  if (filter?.status) assets = assets.filter((asset) => asset.currentStatus === filter.status);
  if (filter?.district) assets = assets.filter((asset) => asset.districtName === filter.district);
  if (filter?.assetGroup) assets = assets.filter((asset) => asset.assetGroup === filter.assetGroup);
  if (filter?.deviceType) assets = assets.filter((asset) => asset.deviceType === filter.deviceType);
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    assets = assets.filter(
      (asset) =>
        asset.assetName.toLowerCase().includes(q) ||
        asset.assetRegistrationNo.toLowerCase().includes(q) ||
        asset.deviceType.toLowerCase().includes(q) ||
        asset.serialNumber.toLowerCase().includes(q)
    );
  }

  return sortFallbackAssets(assets, filter?.sort);
}

/** รายการทรัพย์สินทั้งหมด (admin) หรือเฉพาะหน่วยงาน (officer ไม่จำกัดในตอนนี้) */
export async function listAssets(filter?: AssetListFilter): Promise<AssetWithFacility[]> {
  const { where, values } = buildAssetFilter(filter);
  const orderByMap: Record<NonNullable<AssetListFilter["sort"]>, string> = {
    updated_desc: "a.last_updated_at DESC, a.id DESC",
    updated_asc: "a.last_updated_at ASC, a.id ASC",
    name_asc: "a.asset_name ASC, a.id ASC",
    name_desc: "a.asset_name DESC, a.id DESC",
    ma_soon: "a.maintenance_end_date ASC, a.id ASC",
  };
  const orderBy = filter?.sort ? orderByMap[filter.sort] : "hf.district_name, hf.name, a.row_no, a.id";
  const limit = filter?.limit && Number.isFinite(filter.limit) ? Math.max(1, Math.floor(filter.limit)) : null;
  const offset = filter?.offset && Number.isFinite(filter.offset) ? Math.max(0, Math.floor(filter.offset)) : 0;
  const pageSql = limit ? " LIMIT ? OFFSET ?" : "";
  const sql = `${ASSET_JOIN_SQL} ${where} ORDER BY ${orderBy}${pageSql}`;
  const queryValues = limit ? [...values, limit, offset] : values;

  try {
    const rows = await selectRows<AssetRow>(sql, queryValues);
    return rows.map(rowToAsset);
  } catch {
    const fallback = filterFallbackAssets(filter);
    return limit ? fallback.slice(offset, offset + limit) : fallback;
  }
}

export async function countAssets(filter?: AssetListFilter): Promise<number> {
  const { where, values } = buildAssetFilter(filter);

  try {
    const rows = await selectRows<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total ${ASSET_FROM_SQL} ${where}`,
      values
    );
    return Number(rows[0]?.total ?? 0);
  } catch {
    return filterFallbackAssets(filter).length;
  }
}

/** ดึงทรัพย์สินเดี่ยว */
export async function getAssetById(id: number): Promise<AssetWithFacility | null> {
  try {
    const rows = await selectRows<AssetRow>(`${ASSET_JOIN_SQL} WHERE a.id = ? LIMIT 1`, [id]);
    return rows[0] ? rowToAsset(rows[0]) : null;
  } catch {
    return null;
  }
}

/** ดึง survey list (เพื่อใช้ใน dropdown เลือกหน่วยงานตอน add asset) */
export async function listSurveys(filter?: { facilityId?: number }): Promise<SurveyRow[]> {
  const where = filter?.facilityId ? "WHERE s.facility_id = ?" : "";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  try {
    return await selectRows<SurveyRow>(`
      SELECT s.id, s.facility_id, hf.name AS facility_name, hf.district_name, s.survey_title, s.survey_date, s.personnel_count
      FROM information_asset_surveys s
      JOIN health_facilities hf ON hf.id = s.facility_id
      ${where}
      ORDER BY hf.district_name, hf.name
    `, values);
  } catch {
    return [];
  }
}

export type SurveyLookup = {
  id: number;
  facilityId: number;
};

export async function getSurveyById(id: number): Promise<SurveyLookup | null> {
  const rows = await selectRows<RowDataPacket & { id: number; facility_id: number }>(
    `SELECT id, facility_id FROM information_asset_surveys WHERE id = ? LIMIT 1`,
    [id]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    id: rows[0].id,
    facilityId: rows[0].facility_id,
  };
}

/** เพิ่มทรัพย์สินใหม่ */
export async function createAsset(input: AssetInput) {
  return executeStatement(
    `INSERT INTO information_assets
      (survey_id, row_no, asset_registration_no, asset_name, usage_description, owner_name,
       asset_category, device_type, operating_system, operating_system_version,
       private_ip, public_ip, location_detail, current_status, updated_by,
       manufacturer_brand, manufacturer_model, manufacturer_specification,
       serial_number, purchase_price, purchase_date, purchase_order_no,
       maintenance_start_date, maintenance_end_date, installed_at, last_updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,  
    [
      input.surveyId,
      input.rowNo ?? null,
      input.assetRegistrationNo ?? null,
      input.assetName,
      input.usageDescription ?? null,
      input.ownerName ?? null,
      input.assetCategory,
      input.deviceType ?? null,
      input.operatingSystem ?? null,
      input.operatingSystemVersion ?? null,
      input.privateIp ?? null,
      input.publicIp ?? null,
      input.locationDetail ?? null,
      input.currentStatus ?? "Active",
      input.updatedBy ?? null,
      input.manufacturerBrand ?? null,
      input.manufacturerModel ?? null,
      input.manufacturerSpecification ?? null,
      input.serialNumber ?? null,
      input.purchasePrice ?? null,
      input.purchaseDate ?? null,
      input.purchaseOrderNo ?? null,
      input.maintenanceStartDate ?? null,
      input.maintenanceEndDate ?? null,
      input.installedAt ?? null,
      input.lastUpdatedAt ?? null,
    ]
  );
}

/** แก้ไขทรัพย์สิน */
export async function updateAsset(id: number, input: Partial<AssetInput>) {
  const sets: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    survey_id: input.surveyId,
    asset_registration_no: input.assetRegistrationNo,
    asset_name: input.assetName,
    usage_description: input.usageDescription,
    owner_name: input.ownerName,
    asset_category: input.assetCategory,
    device_type: input.deviceType,
    operating_system: input.operatingSystem,
    operating_system_version: input.operatingSystemVersion,
    private_ip: input.privateIp,
    public_ip: input.publicIp,
    location_detail: input.locationDetail,
    current_status: input.currentStatus,
    updated_by: input.updatedBy,
    manufacturer_brand: input.manufacturerBrand,
    manufacturer_model: input.manufacturerModel,
    manufacturer_specification: input.manufacturerSpecification,
    serial_number: input.serialNumber,
    purchase_price: input.purchasePrice,
    purchase_date: input.purchaseDate ?? null,
    purchase_order_no: input.purchaseOrderNo,
    maintenance_start_date: input.maintenanceStartDate ?? null,
    maintenance_end_date: input.maintenanceEndDate ?? null,
    installed_at: input.installedAt ?? null,
    last_updated_at: input.lastUpdatedAt ?? null,
  };

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val === "" ? null : val);
    }
  }

  if (sets.length === 0) return null;
  values.push(id);
  return executeStatement(`UPDATE information_assets SET ${sets.join(", ")} WHERE id = ?`, values);
}

/** ลบทรัพย์สิน */
export async function deleteAsset(id: number) {
  return executeStatement("DELETE FROM information_assets WHERE id = ?", [id]);
}

/** ดึง asset สำหรับ dropdown เลือก (จำกัดตาม facilityId หลายรายการ) */
export type AssetSelectOption = {
  id: number;
  facilityId: number;
  assetRegistrationNo: string;
  assetName: string;
  deviceType: string | null;
  serialNumber: string | null;
};

export async function listAssetsForFacilityIds(facilityIds: number[]): Promise<AssetSelectOption[]> {
  if (facilityIds.length === 0) return [];
  const placeholders = facilityIds.map(() => "?").join(",");
  try {
    const rows = await selectRows<RowDataPacket & AssetSelectOption>(
      `SELECT a.id, s.facility_id AS facilityId, a.asset_registration_no AS assetRegistrationNo,
              a.asset_name AS assetName, a.device_type AS deviceType, a.serial_number AS serialNumber
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE s.facility_id IN (${placeholders})
       ORDER BY s.facility_id, a.row_no, a.id`,
      facilityIds
    );
    return rows.map((r) => ({
      id: r.id,
      facilityId: r.facilityId,
      assetRegistrationNo: r.assetRegistrationNo,
      assetName: r.assetName,
      deviceType: r.deviceType ?? null,
      serialNumber: r.serialNumber ?? null,
    }));
  } catch {
    return [];
  }
}

/** รายการหน่วยบริการทั้งหมดสำหรับ dropdown (ไม่ขึ้นกับว่ามี survey หรือไม่) */
export type FacilitySelectRow = RowDataPacket & {
  id: number;
  facility_name: string;
  district_name: string | null;
  typecode: string;
};

export async function listAllFacilitiesForSelect(filter?: { facilityId?: number }): Promise<FacilitySelectRow[]> {
  const where = filter?.facilityId ? "WHERE is_active = 1 AND id = ?" : "WHERE is_active = 1";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  try {
    return await selectRows<FacilitySelectRow>(`
      SELECT id, name AS facility_name, district_name, typecode
      FROM health_facilities
      ${where}
      ORDER BY district_name, typecode DESC, name
    `, values);
  } catch {
    return [];
  }
}

/** หา survey ของหน่วยงาน หรือสร้างใหม่ถ้ายังไม่มี */
export async function findOrCreateSurvey(facilityId: number): Promise<number> {
  const rows = await selectRows<RowDataPacket & { id: number }>(
    "SELECT id FROM information_asset_surveys WHERE facility_id = ? LIMIT 1",
    [facilityId]
  );
  if (rows[0]) return rows[0].id;

  const result = await executeStatement(
    "INSERT INTO information_asset_surveys (facility_id, survey_date) VALUES (?, CURDATE())",
    [facilityId]
  );
  return result.insertId;
}

// ── Facilities ─────────────────────────────────────────────────────────────

export type FacilityRow = RowDataPacket & {
  id: number;
  name: string;
  typecode: string;
  district_name: string | null;
  tambon: string | null;
  lat: number | null;
  lon: number | null;
  is_active: number;
  asset_count: number;
  hw_count: number;
  sw_count: number;
  has_survey: number;
};

/** รายการหน่วยบริการทั้งหมด พร้อมจำนวนทรัพย์สิน */
export async function listFacilities(filter?: { facilityId?: number }): Promise<FacilityRow[]> {
  const facilityClause = filter?.facilityId ? "AND hf.id = ?" : "";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  try {
    return await selectRows<FacilityRow>(`
      SELECT
        hf.id,
        hf.name,
        hf.typecode,
        hf.district_name,
        hf.tambon,
        hf.lat,
        hf.lon,
        hf.is_active,
        COUNT(DISTINCT a.id)                                          AS asset_count,
        SUM(CASE WHEN a.asset_category = 'Hardware' THEN 1 ELSE 0 END) AS hw_count,
        SUM(CASE WHEN a.asset_category = 'Software' THEN 1 ELSE 0 END) AS sw_count,
        COUNT(DISTINCT s.id)                                          AS has_survey
      FROM health_facilities hf
      LEFT JOIN information_asset_surveys s ON s.facility_id = hf.id
      LEFT JOIN information_assets a        ON a.survey_id   = s.id
      WHERE hf.is_active = 1 ${facilityClause}
      GROUP BY hf.id
      ORDER BY hf.district_name, hf.typecode DESC, hf.name
    `, values);
  } catch {
    return [];
  }
}

export async function getFacilityById(id: number): Promise<FacilityRow | null> {
  try {
    const rows = await selectRows<FacilityRow>(`
      SELECT
        hf.id,
        hf.name,
        hf.typecode,
        hf.district_name,
        hf.tambon,
        hf.lat,
        hf.lon,
        hf.is_active,
        COUNT(DISTINCT a.id)                                          AS asset_count,
        SUM(CASE WHEN a.asset_category = 'Hardware' THEN 1 ELSE 0 END) AS hw_count,
        SUM(CASE WHEN a.asset_category = 'Software' THEN 1 ELSE 0 END) AS sw_count,
        COUNT(DISTINCT s.id)                                          AS has_survey
      FROM health_facilities hf
      LEFT JOIN information_asset_surveys s ON s.facility_id = hf.id
      LEFT JOIN information_assets a        ON a.survey_id   = s.id
      WHERE hf.id = ?
      GROUP BY hf.id
      LIMIT 1
    `, [id]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ── Facility admin CRUD ────────────────────────────────────────────────────

export type FacilityAdminRow = RowDataPacket & {
  id: number;
  name: string;
  typecode: string;
  district_name: string | null;
  tambon: string | null;
  lat: number | null;
  lon: number | null;
  is_active: number;
  asset_count: number;
};

export async function listFacilitiesAdmin(filter?: { facilityId?: number }): Promise<FacilityAdminRow[]> {
  const where = filter?.facilityId ? "WHERE hf.id = ?" : "";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  try {
    return await selectRows<FacilityAdminRow>(`
      SELECT hf.id, hf.name, hf.typecode, hf.district_name, hf.tambon, hf.lat, hf.lon, hf.is_active,
             COUNT(DISTINCT a.id) AS asset_count
      FROM health_facilities hf
      LEFT JOIN information_asset_surveys s ON s.facility_id = hf.id
      LEFT JOIN information_assets a        ON a.survey_id   = s.id
      ${where}
      GROUP BY hf.id
      ORDER BY hf.district_name, hf.typecode DESC, hf.name
    `, values);
  } catch {
    return [];
  }
}

export async function createFacility(input: {
  name: string;
  typecode: string;
  districtName: string;
  tambon?: string;
  lat?: number;
  lon?: number;
}) {
  return executeStatement(
    `INSERT INTO health_facilities (name, typecode, district_name, tambon, lat, lon, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [input.name, input.typecode, input.districtName, input.tambon ?? "", input.lat ?? 0, input.lon ?? 0]
  );
}

export async function updateFacility(id: number, input: {
  name?: string;
  typecode?: string;
  districtName?: string;
  tambon?: string;
  lat?: number;
  lon?: number;
}) {
  const sets: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    name: input.name,
    typecode: input.typecode,
    district_name: input.districtName,
    tambon: input.tambon,
    lat: input.lat,
    lon: input.lon,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { sets.push(`${col} = ?`); values.push(val); }
  }
  if (!sets.length) return null;
  values.push(id);
  return executeStatement(`UPDATE health_facilities SET ${sets.join(", ")} WHERE id = ?`, values);
}

export async function toggleFacilityActive(id: number, active: boolean) {
  return executeStatement("UPDATE health_facilities SET is_active = ? WHERE id = ?", [active ? 1 : 0, id]);
}
