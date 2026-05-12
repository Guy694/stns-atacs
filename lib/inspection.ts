import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";

// ── Types ──────────────────────────────────────────────────────────────────

export type Inspection = {
  id: number;
  facilityId: number;
  facilityName: string;
  districtName: string;
  roundName: string;
  inspectedBy: string;
  inspectedAt: string;
  note: string;
  totalItems: number;
  foundItems: number;
};

export type InspectionItem = {
  id: number;
  inspectionId: number;
  assetId: number;
  assetName: string;
  assetRegistrationNo: string;
  deviceType: string;
  found: boolean;
  conditionNote: string;
};

export type CreateInspectionInput = {
  facilityId: number;
  roundName: string;
  inspectedBy: string;
  note?: string;
  items: { assetId: number; found: boolean; conditionNote?: string }[];
};

// ── DB Row types ──────────────────────────────────────────────────────────

type InspectionRow = RowDataPacket & {
  id: number;
  facility_id: number;
  facility_name: string | null;
  district_name: string | null;
  round_name: string;
  inspected_by: string;
  inspected_at: Date | string;
  note: string | null;
  total_items: number;
  found_items: number;
};

type InspectionItemRow = RowDataPacket & {
  id: number;
  inspection_id: number;
  asset_id: number;
  asset_name: string | null;
  asset_registration_no: string | null;
  device_type: string | null;
  found: number;
  condition_note: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toDateStr(v: Date | string | null | undefined) {
  if (!v) return "";
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
}

// ── Queries ───────────────────────────────────────────────────────────────

export async function listInspections(facilityId?: number): Promise<Inspection[]> {
  const sql = `
    SELECT
      ai.id,
      ai.facility_id,
      COALESCE(fs.facility_name, '') AS facility_name,
      COALESCE(fs.district_name, '')  AS district_name,
      ai.round_name,
      ai.inspected_by,
      ai.inspected_at,
      COALESCE(ai.note, '')           AS note,
      COUNT(aii.id)                   AS total_items,
      SUM(aii.found)                  AS found_items
    FROM asset_inspections ai
    LEFT JOIN facility_surveys fs ON fs.facility_id = ai.facility_id
    LEFT JOIN asset_inspection_items aii ON aii.inspection_id = ai.id
    ${facilityId ? "WHERE ai.facility_id = ?" : ""}
    GROUP BY ai.id
    ORDER BY ai.inspected_at DESC
  `;
  const rows = await selectRows<InspectionRow>(sql, facilityId ? [facilityId] : []);
  return rows.map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    facilityName: r.facility_name ?? "",
    districtName: r.district_name ?? "",
    roundName: r.round_name,
    inspectedBy: r.inspected_by,
    inspectedAt: toDateStr(r.inspected_at),
    note: r.note ?? "",
    totalItems: Number(r.total_items ?? 0),
    foundItems: Number(r.found_items ?? 0),
  }));
}

export async function getInspectionById(id: number): Promise<Inspection | null> {
  const rows = await selectRows<InspectionRow>(
    `SELECT ai.id, ai.facility_id,
       COALESCE(fs.facility_name,'') AS facility_name,
       COALESCE(fs.district_name,'') AS district_name,
       ai.round_name, ai.inspected_by, ai.inspected_at,
       COALESCE(ai.note,'') AS note,
       COUNT(aii.id) AS total_items, SUM(aii.found) AS found_items
     FROM asset_inspections ai
     LEFT JOIN facility_surveys fs ON fs.facility_id = ai.facility_id
     LEFT JOIN asset_inspection_items aii ON aii.inspection_id = ai.id
     WHERE ai.id = ?
     GROUP BY ai.id`,
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    facilityId: r.facility_id,
    facilityName: r.facility_name ?? "",
    districtName: r.district_name ?? "",
    roundName: r.round_name,
    inspectedBy: r.inspected_by,
    inspectedAt: toDateStr(r.inspected_at),
    note: r.note ?? "",
    totalItems: Number(r.total_items ?? 0),
    foundItems: Number(r.found_items ?? 0),
  };
}

export async function getInspectionItems(inspectionId: number): Promise<InspectionItem[]> {
  const rows = await selectRows<InspectionItemRow>(
    `SELECT aii.id, aii.inspection_id, aii.asset_id,
       ia.asset_name, ia.asset_registration_no, ia.device_type,
       aii.found, COALESCE(aii.condition_note,'') AS condition_note
     FROM asset_inspection_items aii
     JOIN information_assets ia ON ia.id = aii.asset_id
     WHERE aii.inspection_id = ?
     ORDER BY ia.asset_registration_no`,
    [inspectionId]
  );
  return rows.map((r) => ({
    id: r.id,
    inspectionId: r.inspection_id,
    assetId: r.asset_id,
    assetName: r.asset_name ?? "",
    assetRegistrationNo: r.asset_registration_no ?? "",
    deviceType: r.device_type ?? "",
    found: Boolean(r.found),
    conditionNote: r.condition_note ?? "",
  }));
}

export async function createInspection(input: CreateInspectionInput): Promise<number> {
  const result = await executeStatement(
    `INSERT INTO asset_inspections (facility_id, round_name, inspected_by, note)
     VALUES (?, ?, ?, ?)`,
    [input.facilityId, input.roundName, input.inspectedBy, input.note ?? null]
  );
  const inspectionId = result.insertId;

  if (input.items.length > 0) {
    const placeholders = input.items.map(() => "(?,?,?,?)").join(",");
    const values = input.items.flatMap((item) => [
      inspectionId,
      item.assetId,
      item.found ? 1 : 0,
      item.conditionNote ?? null,
    ]);
    await executeStatement(
      `INSERT INTO asset_inspection_items (inspection_id, asset_id, found, condition_note) VALUES ${placeholders}`,
      values
    );
  }

  return inspectionId;
}
