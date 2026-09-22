import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { formatAssetNumber } from "@/lib/asset-number";
import { QUALITY_CHECKS, qualityCheck, SERIAL_PLACEHOLDERS, summarizeQuality, type FacilityQualityRow, type QualityCheck } from "@/lib/data-quality";
import type { FacilityScope } from "@/lib/dashboard-work";
import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

const ON_REGISTER = "COALESCE(a.current_status, '') NOT IN ('Disposed', 'Lost')";

function scope(facilityIds: FacilityScope) {
  if (!facilityIds) return { sql: "", values: [] as unknown[] };
  return { sql: ` AND s.facility_id IN (${facilityIds.map(() => "?").join(",")})`, values: facilityIds as unknown[] };
}

// Newest schema first; each step drops the checks whose columns an older database does not have yet.
const LEVELS: Array<(check: QualityCheck) => boolean> = [
  () => true,
  (check) => check.requires !== "acquisition",
  (check) => !check.requires,
];

export async function getDataQuality(facilities: Array<{ id: number; name: string; district: string }>, facilityIds: FacilityScope) {
  if (facilityIds && !facilityIds.length) return { ...summarizeQuality([], []), availableKeys: [] as string[], missingMigrations: false };
  const where = scope(facilityIds);
  for (const [level, include] of LEVELS.entries()) {
    const checks = QUALITY_CHECKS.filter(include);
    const columns = checks.flatMap((check) => [
      `SUM(CASE WHEN ${check.applies ?? "1 = 1"} THEN 1 ELSE 0 END) AS \`${check.key}_applicable\``,
      `SUM(CASE WHEN (${check.applies ?? "1 = 1"}) AND (${check.missing}) THEN 1 ELSE 0 END) AS \`${check.key}_missing\``,
    ]);
    try {
      const rows = await selectRows<RowDataPacket & Record<string, number>>(
        `SELECT s.facility_id, COUNT(a.id) AS assets, ${columns.join(", ")}
         FROM information_assets a
         JOIN information_asset_surveys s ON s.id = a.survey_id
         WHERE ${ON_REGISTER}${where.sql}
         GROUP BY s.facility_id`,
        where.values
      );
      const byFacility = new Map(rows.map((row) => [Number(row.facility_id), row]));
      const facilityRows: FacilityQualityRow[] = facilities
        .map((facility) => {
          const row = byFacility.get(facility.id);
          return {
            facilityId: facility.id,
            facilityName: facility.name,
            districtName: facility.district,
            assets: Number(row?.assets ?? 0),
            checks: Object.fromEntries(checks.map((check) => [check.key, {
              applicable: Number(row?.[`${check.key}_applicable`] ?? 0),
              missing: Number(row?.[`${check.key}_missing`] ?? 0),
            }])),
          };
        })
        .filter((row) => row.assets > 0);
      const availableKeys = checks.map((check) => check.key);
      return { ...summarizeQuality(facilityRows, availableKeys), availableKeys, missingMigrations: level > 0 };
    } catch (error) {
      if (!isMissingSchemaError(error) || level === LEVELS.length - 1) throw error;
    }
  }
  throw new Error("unreachable");
}

export type IncompleteAsset = { id: number; assetNumber: string; assetName: string; facilityName: string; workGroupName: string; purchasePrice: number | null };

export async function listIncompleteAssets(checkKey: string, facilityIds: FacilityScope, limit = 300): Promise<{ rows: IncompleteAsset[]; total: number } | null> {
  const check = qualityCheck(checkKey);
  if (!check) return null;
  if (facilityIds && !facilityIds.length) return { rows: [], total: 0 };
  const where = scope(facilityIds);
  const from = `
    FROM information_assets a
    JOIN information_asset_surveys s ON s.id = a.survey_id
    LEFT JOIN health_facilities hf ON hf.id = s.facility_id
    LEFT JOIN facility_work_groups fwg ON fwg.id = a.work_group_id
    WHERE ${ON_REGISTER}${where.sql} AND (${check.applies ?? "1 = 1"}) AND (${check.missing})`;
  type Row = RowDataPacket & { id: number; asset_code_prefix?: string | null; asset_registration_no: string | null; asset_name: string; facility_name: string | null; work_group_name: string | null; purchase_price: string | number | null };
  try {
    const rows = await selectRows<Row>(
      `SELECT a.*, hf.name AS facility_name, fwg.work_group_name ${from} ORDER BY hf.name, a.asset_name LIMIT ${Math.min(Math.max(Math.floor(limit), 1), 2000)}`,
      where.values
    );
    const [count] = await selectRows<RowDataPacket & { total: number }>(`SELECT COUNT(*) AS total ${from}`, where.values);
    return {
      total: Number(count?.total ?? rows.length),
      rows: rows.map((row) => ({
        id: row.id,
        assetNumber: formatAssetNumber(row.asset_code_prefix, row.asset_registration_no) || "-",
        assetName: row.asset_name,
        facilityName: row.facility_name ?? "-",
        workGroupName: row.work_group_name ?? "",
        purchasePrice: row.purchase_price === null ? null : Number(row.purchase_price),
      })),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], total: 0 };
    throw error;
  }
}

export type SerialDuplicate = {
  serial: string;
  facilityCount: number;
  assets: Array<{ id: number; assetNumber: string; assetName: string; facilityName: string; status: string }>;
};

/**
 * The same serial number registered more than once — usually a transfer recorded as a new asset or a
 * double import. Same-facility duplicates are blocked when saving; cross-facility ones are only reported.
 */
export async function listSerialDuplicates(facilityIds: FacilityScope, limit = 200): Promise<SerialDuplicate[]> {
  if (facilityIds && !facilityIds.length) return [];
  const placeholders = SERIAL_PLACEHOLDERS.map(() => "?").join(",");
  const meaningful = `CHAR_LENGTH(TRIM(a.serial_number)) >= 3 AND UPPER(TRIM(a.serial_number)) NOT IN (${placeholders})`;
  // Non-admins see duplicates that involve at least one of their facilities.
  const involvesScope = facilityIds ? ` AND SUM(CASE WHEN s.facility_id IN (${facilityIds.map(() => "?").join(",")}) THEN 1 ELSE 0 END) > 0` : "";
  type GroupRow = RowDataPacket & { serial: string };
  const groups = await selectRows<GroupRow>(
    `SELECT TRIM(a.serial_number) AS serial
     FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
     WHERE ${ON_REGISTER} AND ${meaningful}
     GROUP BY TRIM(a.serial_number)
     HAVING COUNT(*) > 1${involvesScope}
     ORDER BY serial
     LIMIT ${Math.min(Math.max(Math.floor(limit), 1), 1000)}`,
    [...SERIAL_PLACEHOLDERS, ...(facilityIds ?? [])]
  );
  if (!groups.length) return [];
  type AssetRow = RowDataPacket & { id: number; serial: string; facility_id: number; facility_name: string | null; asset_name: string; asset_code_prefix?: string | null; asset_registration_no: string | null; current_status: string | null };
  const assets = await selectRows<AssetRow>(
    `SELECT a.*, TRIM(a.serial_number) AS serial, s.facility_id, hf.name AS facility_name
     FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
     LEFT JOIN health_facilities hf ON hf.id = s.facility_id
     WHERE ${ON_REGISTER} AND TRIM(a.serial_number) IN (${groups.map(() => "?").join(",")})
     ORDER BY serial, hf.name`,
    groups.map((group) => group.serial)
  );
  return groups.map((group) => {
    // MySQL groups case-insensitively (general_ci), so compare the same way here.
    const members = assets.filter((asset) => asset.serial.toLowerCase() === group.serial.toLowerCase());
    return {
      serial: group.serial,
      facilityCount: new Set(members.map((asset) => asset.facility_id)).size,
      assets: members.map((asset) => ({
        id: asset.id,
        assetNumber: formatAssetNumber(asset.asset_code_prefix, asset.asset_registration_no) || "-",
        assetName: asset.asset_name,
        facilityName: asset.facility_name ?? "-",
        status: asset.current_status ?? "",
      })),
    };
  });
}

/** Other registered assets with the same serial number (shown as a warning on the asset page). */
export async function findSerialTwins(assetId: number, serial: string) {
  const text = serial.trim();
  if (text.length < 3 || SERIAL_PLACEHOLDERS.includes(text.toUpperCase())) return [];
  const rows = await selectRows<RowDataPacket & { id: number; asset_name: string; facility_name: string | null }>(
    `SELECT a.id, a.asset_name, hf.name AS facility_name
     FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
     LEFT JOIN health_facilities hf ON hf.id = s.facility_id
     WHERE a.id <> ? AND TRIM(a.serial_number) = ? AND ${ON_REGISTER}
     LIMIT 5`,
    [assetId, text]
  );
  return rows.map((row) => ({ id: row.id, assetName: row.asset_name, facilityName: row.facility_name ?? "-" }));
}
