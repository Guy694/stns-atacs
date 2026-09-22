import "server-only";
import { loadAssetExtensions, saveAssetExtension } from "@/lib/asset-extensions";
import type { AssetDetails, AssetExtensions } from "@/lib/asset-details";

import type { RowDataPacket } from "mysql2/promise";

import { facilitySurveys as fallbackSurveys, type AssetRecord } from "@/app/atacs-data";
import { normalizeAssetClass } from "@/lib/asset-classes";
import { formatAssetNumber } from "@/lib/asset-number";
import { isItAsset, parseAssetClass, supportsAgentAsset } from "@/lib/asset-policy";
import { executeStatement, selectRows, withTransaction } from "@/lib/mysql";
import type { WindowsLicenseStatus } from "@/lib/windows-license";

// ── DB Row types ───────────────────────────────────────────────────────────

type AssetRow = RowDataPacket & {
  id: number;
  survey_id: number;
  work_group_id: number | null;
  work_group_name: string | null;
  facility_id: number;
  facility_name: string | null;
  district_name: string | null;
  row_no: number | null;
  asset_registration_no: string | null;
  asset_code_prefix?: string | null;
  asset_accounting_code?: string | null;
  asset_name: string;
  usage_description: string | null;
  owner_name: string | null;
  asset_class: string | null;
  asset_category: "Hardware" | "Software" | null;
  asset_group: string | null;
  device_type: string | null;
  operating_system: string | null;
  operating_system_version: string | null;
  windows_license_status: WindowsLicenseStatus | null;
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
  useful_life_years?: number | null;
  asset_image_1_url: string | null;
  asset_image_2_url: string | null;
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
  // Terminal statuses are written only by approved disposal/loss; never read them back as Active.
  if (["disposed", "จำหน่ายแล้ว", "จำหน่ายออก"].includes(s)) return "Disposed";
  if (["lost", "สูญหาย"].includes(s)) return "Lost";
  return "Active";
}

function normalizeGroup(v: string | null): AssetRecord["assetGroup"] {
  const s = (v ?? "").trim().toLowerCase();
  if (["software", "system", "application", "app", "os"].includes(s)) return "Software";
  return "Hardware";
}

function rowToAsset(row: AssetRow) {
  return {
    extensions: {} as AssetExtensions,
    id: row.id,
    surveyId: row.survey_id,
    workGroupId: row.work_group_id ?? null,
    workGroupName: row.work_group_name ?? null,
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "",
    districtName: row.district_name ?? "",
    rowNo: row.row_no ?? null,
    assetRegistrationNo: row.asset_registration_no ?? "",
    assetCodePrefix: row.asset_code_prefix ?? "",
    assetNumber: formatAssetNumber(row.asset_code_prefix, row.asset_registration_no),
    assetAccountingCode: row.asset_accounting_code ?? "",
    assetName: row.asset_name,
    assetClass: normalizeAssetClass(row.asset_class),
    usageDescription: row.usage_description ?? "",
    ownerName: row.owner_name ?? "",
    assetGroup: row.asset_category ?? normalizeGroup(row.asset_group),
    assetCategory: row.asset_category ?? normalizeGroup(row.asset_group),
    assetGroupDetail: row.asset_group ?? "",
    deviceType: row.device_type ?? "",
    operatingSystem: row.operating_system ?? "",
    operatingSystemVersion: row.operating_system_version ?? "",
    windowsLicenseStatus: row.windows_license_status ?? null,
    privateIp: row.private_ip ?? "",
    publicIp: row.public_ip ?? undefined,
    locationDetail: row.location_detail ?? "",
    currentStatus: normalizeStatus(row.current_status),
    updatedBy: row.updated_by ?? "",
    updatedAt: toDateOnly(row.last_updated_at),
    maintenanceStartDate: toDateOnly(row.maintenance_start_date),
    maintenanceEndDate: toDateOnly(row.maintenance_end_date),
    installedAt: toDateOnly(row.installed_at),
    manufacturerBrand: row.manufacturer_brand ?? "",
    manufacturerModel: row.manufacturer_model ?? "",
    manufacturerSpecification: row.manufacturer_specification ?? "",
    serialNumber: row.serial_number ?? "",
    purchasePrice: row.purchase_price ?? null,
    purchaseDate: toDateOnly(row.purchase_date),
    purchaseOrderNo: row.purchase_order_no ?? "",
    usefulLifeYears: row.useful_life_years ?? null,
    assetImage1Url: row.asset_image_1_url ?? "",
    assetImage2Url: row.asset_image_2_url ?? "",
    assetImages: [row.asset_image_1_url, row.asset_image_2_url].filter((url): url is string => Boolean(url)),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export type AssetWithFacility = ReturnType<typeof rowToAsset>;

export type AssetInput = {
  subtypeId?: number | null;
  details?: AssetDetails;
  surveyId: number;
  workGroupId?: number | null;
  assetRegistrationNo: string | null;
  assetCodePrefix?: string | null;
  assetAccountingCode?: string | null;
  assetName: string;
  assetClass?: string | null;
  usageDescription?: string;
  ownerName?: string;
  assetCategory: "Hardware" | "Software";
  assetGroup?: string;
  deviceType?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  windowsLicenseStatus?: WindowsLicenseStatus | null;
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
  purchaseDate?: string | null;
  purchaseOrderNo?: string;
  maintenanceStartDate?: string | null;
  maintenanceEndDate?: string | null;
  installedAt?: string | null;
  usefulLifeYears?: number | null;
  lastUpdatedAt?: string | null;
  assetImage1Url?: string | null;
  assetImage2Url?: string | null;
  rowNo?: number;
};

export type AssetListFilter = {
  subtypeId?: number;
  facilityId?: number;
  workGroupId?: number;
  status?: string;
  search?: string;
  district?: string;
  assetClass?: string;
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
  LEFT JOIN facility_work_groups fwg ON fwg.id = a.work_group_id
`;

const ASSET_JOIN_SQL = `
  SELECT
    a.*,
    s.facility_id,
    hf.name          AS facility_name,
    hf.district_name,
    fwg.work_group_name
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
      `(a.work_group_id = ? OR EXISTS (
        SELECT 1
        FROM agent_devices ad_wg
        JOIN agent_enrollments ae_wg ON ae_wg.id = ad_wg.enrollment_id
        WHERE ad_wg.linked_asset_id = a.id
          AND ae_wg.work_group_id = ?
      ))`
    );
    values.push(filter.workGroupId, filter.workGroupId);
  }
  if (filter?.status) {
    conditions.push("a.current_status = ?");
    values.push(filter.status);
  }
  if (filter?.search) {
    conditions.push("(a.asset_name LIKE ? OR a.asset_registration_no LIKE ? OR CONCAT(COALESCE(a.asset_code_prefix, ''), COALESCE(a.asset_registration_no, '')) LIKE ? OR a.asset_accounting_code LIKE ? OR a.device_type LIKE ? OR a.serial_number LIKE ? OR EXISTS (SELECT 1 FROM asset_extensions ex LEFT JOIN asset_subtypes st ON st.id = ex.subtype_id WHERE ex.asset_id = a.id AND ex.asset_class = a.asset_class AND (CAST(ex.details AS CHAR) LIKE ? OR st.name LIKE ?)))");
    const like = `%${filter.search}%`;
    values.push(like, like, like, like, like, like, like, like);
  }
  if (filter?.district) {
    conditions.push("hf.district_name = ?");
    values.push(filter.district);
  }
  if (filter?.assetClass) {
    if (filter.assetClass === "Intangible") {
      conditions.push("(a.asset_class = ? OR (COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT' AND a.asset_category = 'Software'))");
    } else {
      conditions.push("COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = ?");
      if (filter.assetClass === "IT") conditions.push("COALESCE(a.asset_category, 'Hardware') <> 'Software'");
    }
    values.push(filter.assetClass);
  }
  if (filter?.subtypeId) {
    conditions.push("EXISTS (SELECT 1 FROM asset_extensions sx WHERE sx.asset_id = a.id AND sx.asset_class = a.asset_class AND sx.subtype_id = ?)");
    values.push(filter.subtypeId);
  }
  if (filter?.assetGroup) {
    conditions.push("COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT' AND a.asset_category = ?");
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
      extensions: {} as AssetExtensions,
      rowNo: null,
      surveyId: 0,
      workGroupId: null,
      workGroupName: null,
      facilityId: s.facilityId,
      facilityName: s.facilityName,
      districtName: s.districtName,
      assetClass: normalizeAssetClass(a.assetClass),
      assetCategory: a.assetGroup,
      assetGroupDetail: "",
      operatingSystemVersion: "",
      manufacturerModel: "",
      manufacturerSpecification: "",
      installedAt: "",
      publicIp: a.publicIp ?? undefined,
      purchasePrice: a.purchasePrice ?? null,
      purchaseDate: a.purchaseDate ?? "",
      purchaseOrderNo: a.purchaseOrderNo ?? "",
      usefulLifeYears: null,
      assetCodePrefix: "",
      assetNumber: a.assetRegistrationNo,
      assetAccountingCode: "",
      maintenanceStartDate: "",
      windowsLicenseStatus: null,
      assetImage1Url: "",
      assetImage2Url: "",
      assetImages: [],
    }))
  );

  if (filter?.facilityId) assets = assets.filter((asset) => asset.facilityId === filter.facilityId);
  if (filter?.workGroupId) assets = [];
  if (filter?.status) assets = assets.filter((asset) => asset.currentStatus === filter.status);
  if (filter?.district) assets = assets.filter((asset) => asset.districtName === filter.district);
  if (filter?.assetClass) assets = assets.filter((asset) => {
    if (filter.assetClass === "Intangible") return asset.assetClass === "Intangible" || (isItAsset(asset) && asset.assetGroup === "Software");
    if (filter.assetClass === "IT") return isItAsset(asset) && asset.assetGroup !== "Software";
    return asset.assetClass === normalizeAssetClass(filter.assetClass);
  });
  if (filter?.subtypeId) assets = assets.filter(asset => asset.extensions[asset.assetClass]?.subtypeId === filter.subtypeId);
  if (filter?.assetGroup) assets = assets.filter((asset) => isItAsset(asset) && asset.assetGroup === filter.assetGroup);
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

  let rows: AssetRow[];
  try {
    rows = await selectRows<AssetRow>(sql, queryValues);
  } catch (error) {
    if (filter?.search) throw error; // A missing extension schema must not look like sample search results.
    const fallback = filterFallbackAssets(filter);
    return limit ? fallback.slice(offset, offset + limit) : fallback;
  }
  const extensions = await loadAssetExtensions(rows.map(row => row.id));
  return rows.map(row => ({ ...rowToAsset(row), extensions: extensions.get(row.id) ?? {} }));
}

export async function countAssets(filter?: AssetListFilter): Promise<number> {
  const { where, values } = buildAssetFilter(filter);

  try {
    const rows = await selectRows<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total ${ASSET_FROM_SQL} ${where}`,
      values
    );
    return Number(rows[0]?.total ?? 0);
  } catch (error) {
    if (filter?.search) throw error;
    return filterFallbackAssets(filter).length;
  }
}

/** ดึงทรัพย์สินเดี่ยว */
export async function getAssetById(id: number): Promise<AssetWithFacility | null> {
  const rows = await selectRows<AssetRow>(`${ASSET_JOIN_SQL} WHERE a.id = ? LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const extensions = await loadAssetExtensions([id]);
  return { ...rowToAsset(rows[0]), extensions: extensions.get(id) ?? {} };
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
  return withTransaction(async () => {
    const result = await executeStatement(
      `INSERT INTO information_assets
        (survey_id, row_no, asset_registration_no, asset_name, usage_description, owner_name,
         work_group_id, asset_class, asset_category, asset_group, device_type, operating_system, operating_system_version, windows_license_status,
         private_ip, public_ip, location_detail, current_status, updated_by,
         manufacturer_brand, manufacturer_model, manufacturer_specification,
         serial_number, purchase_price, purchase_date, purchase_order_no,
         maintenance_start_date, maintenance_end_date, installed_at, last_updated_at,
         asset_image_1_url, asset_image_2_url)
       VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?
       )`,
      [
        input.surveyId,
        input.rowNo ?? null,
        input.assetRegistrationNo ?? null,
        input.assetName,
        input.usageDescription ?? null,
        input.ownerName ?? null,
        input.workGroupId ?? null,
        parseAssetClass(input.assetClass),
        input.assetCategory,
        input.assetGroup ?? null,
        input.deviceType ?? null,
        input.operatingSystem ?? null,
        input.operatingSystemVersion ?? null,
        input.windowsLicenseStatus ?? null,
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
        input.assetImage1Url ?? null,
        input.assetImage2Url ?? null,
      ]
    );
    const codeColumns: Array<[string, string | null | undefined]> = [["asset_code_prefix", input.assetCodePrefix], ["asset_accounting_code", input.assetAccountingCode]];
    const providedCodes = codeColumns.filter(([, value]) => value);
    if (providedCodes.length) {
      await executeStatement(
        `UPDATE information_assets SET ${providedCodes.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`,
        [...providedCodes.map(([, value]) => value), result.insertId]
      );
    }
    if (input.usefulLifeYears != null) {
      // Written separately so installs without the lifecycle migration keep creating assets normally.
      await executeStatement("UPDATE information_assets SET useful_life_years = ? WHERE id = ?", [input.usefulLifeYears, result.insertId]);
    }
    await saveAssetExtension(result.insertId, parseAssetClass(input.assetClass), input.subtypeId, input.details);
    return result;
  });
}

/** แก้ไขทรัพย์สิน */
export async function updateAsset(id: number, input: Partial<AssetInput>) {
  return withTransaction(async () => {
    const locked = await selectRows<RowDataPacket>("SELECT * FROM information_assets WHERE id = ? FOR UPDATE", [id]);
    if (input.assetClass !== undefined) parseAssetClass(input.assetClass);
    // Any classification change on a linked record must leave it eligible for Agent updates.
    if (input.assetClass !== undefined || input.assetCategory !== undefined || input.deviceType !== undefined || input.surveyId !== undefined) {
      const linked = await selectRows<RowDataPacket & { asset_class: string | null; asset_category: string; device_type: string | null; survey_id: number }>(
        "SELECT a.asset_class, a.asset_category, a.device_type, a.survey_id FROM information_assets a WHERE a.id = ? AND EXISTS (SELECT 1 FROM agent_devices ad WHERE ad.linked_asset_id = a.id)", [id]
      );
      const current = linked[0];
      if (current && (!supportsAgentAsset({
        assetClass: input.assetClass === undefined ? current.asset_class : input.assetClass,
        assetCategory: input.assetCategory ?? current.asset_category,
        deviceType: input.deviceType === undefined ? current.device_type : input.deviceType,
      }) || (input.surveyId !== undefined && input.surveyId !== current.survey_id))) {
        throw new Error("ทรัพย์สินนี้ผูกกับ Agent อยู่ กรุณายกเลิกการเชื่อมก่อนเปลี่ยนกลุ่ม ประเภท หรือหน่วยงาน");
      }
    }
    const sets: string[] = [];
    const values: unknown[] = [];

    const fieldMap: Record<string, unknown> = {
      survey_id: input.surveyId,
      work_group_id: input.workGroupId,
      asset_registration_no: input.assetRegistrationNo,
      asset_name: input.assetName,
      usage_description: input.usageDescription,
      owner_name: input.ownerName,
      asset_class: input.assetClass === undefined ? undefined : parseAssetClass(input.assetClass),
      asset_category: input.assetCategory,
      asset_group: input.assetGroup,
      device_type: input.deviceType,
      operating_system: input.operatingSystem,
      operating_system_version: input.operatingSystemVersion,
      windows_license_status: input.windowsLicenseStatus,
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
      purchase_date: input.purchaseDate,
      purchase_order_no: input.purchaseOrderNo,
      maintenance_start_date: input.maintenanceStartDate,
      maintenance_end_date: input.maintenanceEndDate,
      installed_at: input.installedAt,
      last_updated_at: input.lastUpdatedAt,
      asset_image_1_url: input.assetImage1Url,
      asset_image_2_url: input.assetImage2Url,
      // Clearing an override is a no-op on databases that predate the lifecycle migration.
      useful_life_years: input.usefulLifeYears === null && locked[0] && !("useful_life_years" in locked[0]) ? undefined : input.usefulLifeYears,
      // Clearing is a no-op on databases without the asset-code migration; setting a value requires it.
      asset_code_prefix: !input.assetCodePrefix && locked[0] && !("asset_code_prefix" in locked[0]) ? undefined : input.assetCodePrefix,
      asset_accounting_code: !input.assetAccountingCode && locked[0] && !("asset_accounting_code" in locked[0]) ? undefined : input.assetAccountingCode,
    };

    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        sets.push(`${col} = ?`);
        values.push(val === "" ? null : val);
      }
    }

    if ((input.details !== undefined || input.subtypeId !== undefined) && !locked[0]) throw new Error("ไม่พบทรัพย์สิน");
    await saveAssetExtension(id, parseAssetClass(input.assetClass, locked[0]?.asset_class), input.subtypeId, input.details);
    if (sets.length === 0) return null;
    values.push(id);
    return executeStatement(`UPDATE information_assets SET ${sets.join(", ")} WHERE id = ?`, values);
  });
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
  assetClass: string | null;
  assetCategory: "Hardware" | "Software";
};

export async function listAssetsForFacilityIds(facilityIds: number[]): Promise<AssetSelectOption[]> {
  if (facilityIds.length === 0) return [];
  const placeholders = facilityIds.map(() => "?").join(",");
  try {
    const rows = await selectRows<RowDataPacket & AssetSelectOption>(
      `SELECT a.id, s.facility_id AS facilityId, a.asset_registration_no AS assetRegistrationNo,
              a.asset_name AS assetName, a.device_type AS deviceType, a.serial_number AS serialNumber,
              a.asset_class AS assetClass, a.asset_category AS assetCategory
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
      assetClass: r.assetClass,
      assetCategory: r.assetCategory,
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
  asset_code_prefix?: string | null;
};

export async function listAllFacilitiesForSelect(filter?: { facilityId?: number }): Promise<FacilitySelectRow[]> {
  const where = filter?.facilityId ? "WHERE is_active = 1 AND id = ?" : "WHERE is_active = 1";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  const query = (columns: string) => selectRows<FacilitySelectRow>(`
      SELECT ${columns}
      FROM health_facilities
      ${where}
      ORDER BY district_name, typecode DESC, name
    `, values);
  try {
    return await query("id, name AS facility_name, district_name, typecode, asset_code_prefix");
  } catch {
    // Databases without the asset-code migration still list facilities (no default prefix).
    try {
      return await query("id, name AS facility_name, district_name, typecode");
    } catch {
      return [];
    }
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
export async function listFacilities(filter?: { facilityId?: number; facilityIds?: number[] }): Promise<FacilityRow[]> {
  const scopedFacilityIds = filter?.facilityIds?.filter((id) => Number.isInteger(id) && id > 0) ?? [];
  const facilityClause = filter?.facilityId
    ? "AND hf.id = ?"
    : scopedFacilityIds.length > 0
      ? `AND hf.id IN (${scopedFacilityIds.map(() => "?").join(", ")})`
      : filter?.facilityIds
        ? "AND 1 = 0"
        : "";
  const values = filter?.facilityId ? [filter.facilityId] : scopedFacilityIds;
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
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT' AND a.asset_category = 'Hardware' THEN 1 ELSE 0 END) AS hw_count,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT' AND a.asset_category = 'Software' THEN 1 ELSE 0 END) AS sw_count,
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
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT' AND a.asset_category = 'Hardware' THEN 1 ELSE 0 END) AS hw_count,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(a.asset_class), ''), 'IT') = 'IT' AND a.asset_category = 'Software' THEN 1 ELSE 0 END) AS sw_count,
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
  asset_code_prefix?: string | null;
};

export async function listFacilitiesAdmin(filter?: { facilityId?: number }): Promise<FacilityAdminRow[]> {
  const where = filter?.facilityId ? "WHERE hf.id = ?" : "";
  const values = filter?.facilityId ? [filter.facilityId] : [];
  const query = (extra: string) => selectRows<FacilityAdminRow>(`
      SELECT hf.id, hf.name, hf.typecode, hf.district_name, hf.tambon, hf.lat, hf.lon, hf.is_active,${extra}
             COUNT(DISTINCT a.id) AS asset_count
      FROM health_facilities hf
      LEFT JOIN information_asset_surveys s ON s.facility_id = hf.id
      LEFT JOIN information_assets a        ON a.survey_id   = s.id
      ${where}
      GROUP BY hf.id
      ORDER BY hf.district_name, hf.typecode DESC, hf.name
    `, values);
  try {
    return await query(" hf.asset_code_prefix,");
  } catch {
    try {
      return await query("");
    } catch {
      return [];
    }
  }
}

export async function createFacility(input: {
  name: string;
  typecode: string;
  districtName: string;
  tambon?: string;
  lat?: number;
  lon?: number;
  assetCodePrefix?: string;
}) {
  const result = await executeStatement(
    `INSERT INTO health_facilities (name, typecode, district_name, tambon, lat, lon, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [input.name, input.typecode, input.districtName, input.tambon ?? "", input.lat ?? 0, input.lon ?? 0]
  );
  if (input.assetCodePrefix) {
    await executeStatement("UPDATE health_facilities SET asset_code_prefix = ? WHERE id = ?", [input.assetCodePrefix, result.insertId]);
  }
  return result;
}

export async function updateFacility(id: number, input: {
  name?: string;
  typecode?: string;
  districtName?: string;
  tambon?: string;
  lat?: number;
  lon?: number;
  /** "" clears the default prefix; undefined leaves it unchanged. */
  assetCodePrefix?: string;
}) {
  const sets: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    asset_code_prefix: input.assetCodePrefix === undefined ? undefined : input.assetCodePrefix || null,
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
