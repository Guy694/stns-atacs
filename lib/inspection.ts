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
  startDate: string;
  endDate: string;
  note: string;
  totalItems: number;
  checkedItems: number;
  foundItems: number;
  missingItems: number;
  remainingItems: number;
};

export type InspectionItem = {
  id: number;
  inspectionId: number;
  assetId: number;
  assetName: string;
  assetRegistrationNo: string;
  deviceType: string;
  currentStatus: string;
  found: boolean;
  inspectionStatus: "Pending" | "Found" | "Missing";
  assetStatus: string;
  conditionNote: string;
  checkedBy: string;
  checkedAt: string;
};

export type CreateInspectionInput = {
  facilityId: number;
  roundName: string;
  inspectedBy: string;
  startDate: string;
  endDate: string;
  note?: string;
  items: { assetId: number }[];
};

export type InspectionItemContext = {
  id: number;
  inspectionId: number;
  facilityId: number;
  assetId: number;
  currentStatus: string | null;
};

export type UpdateInspectionItemInput = {
  itemId: number;
  inspectionStatus: "Found" | "Missing";
  assetStatus: string;
  conditionNote?: string | null;
  checkedBy: string;
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
  start_date: Date | string | null;
  end_date: Date | string | null;
  note: string | null;
  total_items: number;
  checked_items: number;
  found_items: number;
  missing_items: number;
};

type InspectionItemRow = RowDataPacket & {
  id: number;
  inspection_id: number;
  asset_id: number;
  asset_name: string | null;
  asset_registration_no: string | null;
  device_type: string | null;
  current_status: string | null;
  found: number;
  inspection_status: string | null;
  asset_status: string | null;
  condition_note: string | null;
  checked_by: string | null;
  checked_at: Date | string | null;
};

type InspectionItemContextRow = RowDataPacket & {
  id: number;
  inspection_id: number;
  facility_id: number;
  asset_id: number;
  current_status: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toDateStr(v: Date | string | null | undefined) {
  if (!v) return "";
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
}

function toDateTimeStr(v: Date | string | null | undefined) {
  if (!v) return "";
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 19).replace("T", " ");
}

function normalizeInspectionStatus(value: string | null | undefined): InspectionItem["inspectionStatus"] {
  if (value === "Found" || value === "Missing") return value;
  return "Pending";
}

function mapInspection(row: InspectionRow): Inspection {
  const totalItems = Number(row.total_items ?? 0);
  const checkedItems = Number(row.checked_items ?? 0);
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "",
    districtName: row.district_name ?? "",
    roundName: row.round_name,
    inspectedBy: row.inspected_by,
    inspectedAt: toDateStr(row.inspected_at),
    startDate: toDateStr(row.start_date),
    endDate: toDateStr(row.end_date),
    note: row.note ?? "",
    totalItems,
    checkedItems,
    foundItems: Number(row.found_items ?? 0),
    missingItems: Number(row.missing_items ?? 0),
    remainingItems: Math.max(0, totalItems - checkedItems),
  };
}

const INSPECTION_SUMMARY_SELECT = `
  COUNT(aii.id) AS total_items,
  SUM(CASE WHEN COALESCE(aii.inspection_status, 'Pending') <> 'Pending' THEN 1 ELSE 0 END) AS checked_items,
  SUM(CASE WHEN COALESCE(aii.inspection_status, 'Pending') = 'Found' THEN 1 ELSE 0 END) AS found_items,
  SUM(CASE WHEN COALESCE(aii.inspection_status, 'Pending') = 'Missing' THEN 1 ELSE 0 END) AS missing_items
`;

// ── Queries ───────────────────────────────────────────────────────────────

export async function listInspections(facilityId?: number): Promise<Inspection[]> {
  const sql = `
    SELECT
      ai.id,
      ai.facility_id,
      COALESCE(hf.name, '')           AS facility_name,
      COALESCE(hf.district_name, '')  AS district_name,
      ai.round_name,
      ai.inspected_by,
      ai.inspected_at,
      ai.start_date,
      ai.end_date,
      COALESCE(ai.note, '')           AS note,
      ${INSPECTION_SUMMARY_SELECT}
    FROM asset_inspections ai
    LEFT JOIN health_facilities hf ON hf.id = ai.facility_id
    LEFT JOIN asset_inspection_items aii ON aii.inspection_id = ai.id
    ${facilityId ? "WHERE ai.facility_id = ?" : ""}
    GROUP BY ai.id
    ORDER BY ai.inspected_at DESC
  `;
  const rows = await selectRows<InspectionRow>(sql, facilityId ? [facilityId] : []);
  return rows.map(mapInspection);
}

export async function getInspectionById(id: number): Promise<Inspection | null> {
  const rows = await selectRows<InspectionRow>(
    `SELECT ai.id, ai.facility_id,
       COALESCE(hf.name,'') AS facility_name,
       COALESCE(hf.district_name,'') AS district_name,
       ai.round_name, ai.inspected_by, ai.inspected_at, ai.start_date, ai.end_date,
       COALESCE(ai.note,'') AS note,
       ${INSPECTION_SUMMARY_SELECT}
     FROM asset_inspections ai
     LEFT JOIN health_facilities hf ON hf.id = ai.facility_id
     LEFT JOIN asset_inspection_items aii ON aii.inspection_id = ai.id
     WHERE ai.id = ?
     GROUP BY ai.id`,
    [id]
  );
  if (!rows[0]) return null;
  return mapInspection(rows[0]);
}

export async function getInspectionItems(inspectionId: number): Promise<InspectionItem[]> {
  const rows = await selectRows<InspectionItemRow>(
    `SELECT aii.id, aii.inspection_id, aii.asset_id,
       ia.asset_name, ia.asset_registration_no, ia.device_type, ia.current_status,
       aii.found, COALESCE(aii.inspection_status, 'Pending') AS inspection_status,
       COALESCE(aii.asset_status, '') AS asset_status,
       COALESCE(aii.condition_note,'') AS condition_note,
       COALESCE(aii.checked_by, '') AS checked_by,
       aii.checked_at
     FROM asset_inspection_items aii
     JOIN information_assets ia ON ia.id = aii.asset_id
     WHERE aii.inspection_id = ?
     ORDER BY COALESCE(aii.inspection_status, 'Pending') = 'Pending' DESC, ia.asset_registration_no`,
    [inspectionId]
  );
  return rows.map((r) => ({
    id: r.id,
    inspectionId: r.inspection_id,
    assetId: r.asset_id,
    assetName: r.asset_name ?? "",
    assetRegistrationNo: r.asset_registration_no ?? "",
    deviceType: r.device_type ?? "",
    currentStatus: r.current_status ?? "",
    found: Boolean(r.found),
    inspectionStatus: normalizeInspectionStatus(r.inspection_status),
    assetStatus: r.asset_status ?? "",
    conditionNote: r.condition_note ?? "",
    checkedBy: r.checked_by ?? "",
    checkedAt: toDateTimeStr(r.checked_at),
  }));
}

export async function createInspection(input: CreateInspectionInput): Promise<number> {
  const result = await executeStatement(
    `INSERT INTO asset_inspections (facility_id, round_name, inspected_by, start_date, end_date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.facilityId, input.roundName, input.inspectedBy, input.startDate, input.endDate, input.note ?? null]
  );
  const inspectionId = result.insertId;

  if (input.items.length > 0) {
    const placeholders = input.items.map(() => "(?,?,?,?,?)").join(",");
    const values = input.items.flatMap((item) => [
      inspectionId,
      item.assetId,
      0,
      "Pending",
      null,
    ]);
    await executeStatement(
      `INSERT INTO asset_inspection_items (inspection_id, asset_id, found, inspection_status, asset_status) VALUES ${placeholders}`,
      values
    );
  }

  return inspectionId;
}

export async function getInspectionItemContext(itemId: number): Promise<InspectionItemContext | null> {
  const rows = await selectRows<InspectionItemContextRow>(
    `SELECT aii.id, aii.inspection_id, ai.facility_id, aii.asset_id, ia.current_status
     FROM asset_inspection_items aii
     JOIN asset_inspections ai ON ai.id = aii.inspection_id
     JOIN information_assets ia ON ia.id = aii.asset_id
     WHERE aii.id = ?
     LIMIT 1`,
    [itemId]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    inspectionId: rows[0].inspection_id,
    facilityId: rows[0].facility_id,
    assetId: rows[0].asset_id,
    currentStatus: rows[0].current_status,
  };
}

export async function updateInspectionItem(input: UpdateInspectionItemInput) {
  await executeStatement(
    `UPDATE asset_inspection_items
     SET found = ?,
         inspection_status = ?,
         asset_status = ?,
         condition_note = ?,
         checked_by = ?,
         checked_at = NOW()
     WHERE id = ?`,
    [
      input.inspectionStatus === "Found" ? 1 : 0,
      input.inspectionStatus,
      input.assetStatus,
      input.conditionNote?.trim() || null,
      input.checkedBy,
      input.itemId,
    ]
  );
}
