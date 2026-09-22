import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { formatAssetNumber } from "@/lib/asset-number";
import { executeStatement, selectRows, withTransaction } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

/** Runs the query that needs the newest columns, falling back to the legacy shape before migration. */
async function withSchemaFallback<T>(current: () => Promise<T>, legacy: () => Promise<T>) {
  try {
    return await current();
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    return legacy();
  }
}

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
  workGroupId: number | null;
  workGroupName: string;
  roundStatus: "Open" | "Closed";
  closedAt: string;
  closedBy: string;
  committeeOrderNo: string;
  committeeOrderDate: string;
};

export type CommitteeMember = { seq: number; role: "chair" | "member"; fullName: string; position: string };
export const COMMITTEE_SIZE = 4;

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
  assetClass: string;
  assetGroup: "Hardware" | "Software";
  subtypeName: string;
  workGroupId: number | null;
  workGroupName: string;
  locationDetail: string;
  purchaseDate: string;
  installedAt: string;
  purchasePrice: number | null;
  assetCodePrefix: string;
  assetNumber: string;
  assetAccountingCode: string;
  /** Where the item was actually found (null = not recorded). Registered work group is snapshotted at check time. */
  foundWorkGroupId: number | null;
  foundWorkGroupName: string;
  foundLocation: string;
  registeredWorkGroupId: number | null;
  registeredWorkGroupName: string;
};

export type CreateInspectionInput = {
  facilityId: number;
  roundName: string;
  inspectedBy: string;
  startDate: string;
  endDate: string;
  note?: string;
  workGroupId?: number | null;
  committee?: CommitteeMember[];
  items: { assetId: number }[];
};

export type InspectionItemContext = {
  id: number;
  inspectionId: number;
  facilityId: number;
  assetId: number;
  currentStatus: string | null;
  workGroupId: number | null;
  locationDetail: string;
};

export type UpdateInspectionItemInput = {
  itemId: number;
  inspectionStatus: "Found" | "Missing";
  assetStatus: string;
  conditionNote?: string | null;
  checkedBy: string;
  /** undefined = not part of this form; null = found but no work group. */
  foundWorkGroupId?: number | null;
  foundLocation?: string;
  registeredWorkGroupId?: number | null;
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
  work_group_id?: number | null;
  work_group_name?: string | null;
  round_status?: string | null;
  closed_at?: Date | string | null;
  closed_by?: string | null;
  committee_order_no?: string | null;
  committee_order_date?: Date | string | null;
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
  asset_class: string | null;
  asset_category: "Hardware" | "Software" | null;
  subtype_name: string | null;
  work_group_id: number | null;
  work_group_name: string | null;
  location_detail: string | null;
  purchase_date: Date | string | null;
  installed_at: Date | string | null;
  purchase_price: string | number | null;
  asset_code_prefix?: string | null;
  asset_accounting_code?: string | null;
  found_work_group_id?: number | null;
  found_work_group_name?: string | null;
  found_location?: string | null;
  registered_work_group_id?: number | null;
  registered_work_group_name?: string | null;
};

type InspectionItemContextRow = RowDataPacket & {
  id: number;
  inspection_id: number;
  facility_id: number;
  asset_id: number;
  current_status: string | null;
  work_group_id: number | null;
  location_detail: string | null;
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
    workGroupId: row.work_group_id ?? null,
    workGroupName: row.work_group_name ?? "",
    roundStatus: row.round_status === "Closed" ? "Closed" : "Open",
    closedAt: toDateTimeStr(row.closed_at),
    closedBy: row.closed_by ?? "",
    committeeOrderNo: row.committee_order_no ?? "",
    committeeOrderDate: toDateStr(row.committee_order_date),
  };
}

const INSPECTION_SUMMARY_SELECT = `
  COUNT(aii.id) AS total_items,
  SUM(CASE WHEN COALESCE(aii.inspection_status, 'Pending') <> 'Pending' THEN 1 ELSE 0 END) AS checked_items,
  SUM(CASE WHEN COALESCE(aii.inspection_status, 'Pending') = 'Found' THEN 1 ELSE 0 END) AS found_items,
  SUM(CASE WHEN COALESCE(aii.inspection_status, 'Pending') = 'Missing' THEN 1 ELSE 0 END) AS missing_items
`;

// Columns added by later migrations (read with fallbacks so older databases keep working).
const WORK_GROUP_COLUMNS = "ai.work_group_id, fwg.work_group_name,";
const CLOSE_COLUMNS = "ai.round_status, ai.closed_at, ai.closed_by,";
const ORDER_COLUMNS = "ai.committee_order_no, ai.committee_order_date,";

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
  const extend = (columns: string) => sql
    .replace("COALESCE(ai.note, '')           AS note,", `COALESCE(ai.note, '')           AS note, ${columns}`)
    .replace("LEFT JOIN asset_inspection_items aii", "LEFT JOIN facility_work_groups fwg ON fwg.id = ai.work_group_id\n    LEFT JOIN asset_inspection_items aii");
  const values = facilityId ? [facilityId] : [];
  const rows = await withSchemaFallback(
    () => selectRows<InspectionRow>(extend(`${WORK_GROUP_COLUMNS} ${CLOSE_COLUMNS}`), values),
    () => withSchemaFallback(() => selectRows<InspectionRow>(extend(WORK_GROUP_COLUMNS), values), () => selectRows<InspectionRow>(sql, values))
  );
  return rows.map(mapInspection);
}

export async function getInspectionById(id: number): Promise<Inspection | null> {
  const query = (level: 0 | 1 | 2 | 3) => selectRows<InspectionRow>(
    `SELECT ai.id, ai.facility_id,
       COALESCE(hf.name,'') AS facility_name,
       COALESCE(hf.district_name,'') AS district_name,
       ai.round_name, ai.inspected_by, ai.inspected_at, ai.start_date, ai.end_date,
       COALESCE(ai.note,'') AS note,${level >= 1 ? ` ${WORK_GROUP_COLUMNS}` : ""}${level >= 2 ? ` ${CLOSE_COLUMNS}` : ""}${level === 3 ? ` ${ORDER_COLUMNS}` : ""}
       ${INSPECTION_SUMMARY_SELECT}
     FROM asset_inspections ai
     LEFT JOIN health_facilities hf ON hf.id = ai.facility_id${level >= 1 ? "\n     LEFT JOIN facility_work_groups fwg ON fwg.id = ai.work_group_id" : ""}
     LEFT JOIN asset_inspection_items aii ON aii.inspection_id = ai.id
     WHERE ai.id = ?
     GROUP BY ai.id`,
    [id]
  );
  const rows = await withSchemaFallback(
    () => query(3),
    () => withSchemaFallback(() => query(2), () => withSchemaFallback(() => query(1), () => query(0)))
  );
  if (!rows[0]) return null;
  return mapInspection(rows[0]);
}

export async function getInspectionItems(inspectionId: number): Promise<InspectionItem[]> {
  // level 2: asset codes + found location, 1: asset codes, 0: base schema.
  const query = (level: 0 | 1 | 2) => selectRows<InspectionItemRow>(
    `SELECT aii.id, aii.inspection_id, aii.asset_id,${level >= 1 ? " ia.asset_code_prefix, ia.asset_accounting_code," : ""}${level === 2 ? " aii.found_work_group_id, ffwg.work_group_name AS found_work_group_name, aii.found_location, aii.registered_work_group_id, rfwg.work_group_name AS registered_work_group_name," : ""}
       ia.asset_name, ia.asset_registration_no, ia.device_type, ia.current_status,
       aii.found, COALESCE(aii.inspection_status, 'Pending') AS inspection_status,
       COALESCE(aii.asset_status, '') AS asset_status,
       COALESCE(aii.condition_note,'') AS condition_note,
       COALESCE(aii.checked_by, '') AS checked_by,
       aii.checked_at,
       ia.asset_class, ia.asset_category, ia.work_group_id, fwg.work_group_name, ia.location_detail,
       ia.purchase_date, ia.installed_at, ia.purchase_price,
       (SELECT st.name FROM asset_extensions ex
        JOIN asset_subtypes st ON st.id = ex.subtype_id AND st.asset_class = ex.asset_class
        WHERE ex.asset_id = ia.id AND ex.asset_class = ia.asset_class LIMIT 1) AS subtype_name
     FROM asset_inspection_items aii
     JOIN information_assets ia ON ia.id = aii.asset_id
     LEFT JOIN facility_work_groups fwg ON fwg.id = ia.work_group_id${level === 2 ? `
     LEFT JOIN facility_work_groups ffwg ON ffwg.id = aii.found_work_group_id
     LEFT JOIN facility_work_groups rfwg ON rfwg.id = aii.registered_work_group_id` : ""}
     WHERE aii.inspection_id = ?
     ORDER BY COALESCE(aii.inspection_status, 'Pending') = 'Pending' DESC, ia.asset_registration_no`,
    [inspectionId]
  );
  const rows = await withSchemaFallback(() => query(2), () => withSchemaFallback(() => query(1), () => query(0)));
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
    assetClass: r.asset_class?.trim() || "IT",
    assetGroup: r.asset_category ?? "Hardware",
    subtypeName: r.subtype_name ?? "",
    workGroupId: r.work_group_id ?? null,
    workGroupName: r.work_group_name ?? "",
    locationDetail: r.location_detail ?? "",
    purchaseDate: toDateStr(r.purchase_date),
    installedAt: toDateStr(r.installed_at),
    purchasePrice: r.purchase_price === null || r.purchase_price === undefined ? null : Number(r.purchase_price),
    assetCodePrefix: r.asset_code_prefix ?? "",
    assetNumber: formatAssetNumber(r.asset_code_prefix, r.asset_registration_no),
    assetAccountingCode: r.asset_accounting_code ?? "",
    foundWorkGroupId: r.found_work_group_id ?? null,
    foundWorkGroupName: r.found_work_group_name ?? "",
    foundLocation: r.found_location ?? "",
    registeredWorkGroupId: r.registered_work_group_id ?? null,
    registeredWorkGroupName: r.registered_work_group_name ?? "",
  }));
}

export async function createInspection(input: CreateInspectionInput): Promise<number> {
  return withTransaction(async () => {
    const result = input.workGroupId
      ? await executeStatement(
          `INSERT INTO asset_inspections (facility_id, work_group_id, round_name, inspected_by, start_date, end_date, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [input.facilityId, input.workGroupId, input.roundName, input.inspectedBy, input.startDate, input.endDate, input.note ?? null]
        )
      : await executeStatement(
          `INSERT INTO asset_inspections (facility_id, round_name, inspected_by, start_date, end_date, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [input.facilityId, input.roundName, input.inspectedBy, input.startDate, input.endDate, input.note ?? null]
        );
    const inspectionId = result.insertId;

    if (input.items.length > 0) {
      const placeholders = input.items.map(() => "(?,?,?,?,?)").join(",");
      const values = input.items.flatMap((item) => [inspectionId, item.assetId, 0, "Pending", null]);
      await executeStatement(
        `INSERT INTO asset_inspection_items (inspection_id, asset_id, found, inspection_status, asset_status) VALUES ${placeholders}`,
        values
      );
    }
    if (input.committee?.length) await writeCommittee(inspectionId, input.committee);
    return inspectionId;
  });
}

export const COMMITTEE_ROLE_LABELS: Record<CommitteeMember["role"], string> = { chair: "ประธานกรรมการ", member: "กรรมการ" };

/**
 * Normalises form input: blank rows are dropped, at most COMMITTEE_SIZE members, exactly one chair.
 * The chair is stored first (seq 1) so it prints first in the signature block.
 */
export function normalizeCommittee(rows: Array<{ fullName?: string; position?: string; role?: string }>): CommitteeMember[] {
  const cleaned = rows.slice(0, COMMITTEE_SIZE).map((row) => ({
    role: (row.role === "chair" ? "chair" : "member") as CommitteeMember["role"],
    fullName: (row.fullName ?? "").trim().slice(0, 255),
    position: (row.position ?? "").trim().slice(0, 255),
  }));
  if (cleaned.some((member) => !member.fullName && member.position)) throw new Error("กรุณาระบุชื่อกรรมการให้ครบทุกแถวที่กรอกตำแหน่ง");
  const members = cleaned.filter((member) => member.fullName);
  if (!members.length) return [];
  const chairs = members.filter((member) => member.role === "chair").length;
  if (chairs === 0) throw new Error("กรุณาเลือกประธานกรรมการ 1 คน");
  if (chairs > 1) throw new Error("เลือกประธานกรรมการได้เพียง 1 คน");
  return [...members.filter((m) => m.role === "chair"), ...members.filter((m) => m.role === "member")]
    .map((member, index) => ({ ...member, seq: index + 1 }));
}

async function writeCommittee(inspectionId: number, members: CommitteeMember[]) {
  await executeStatement("DELETE FROM asset_inspection_committee WHERE inspection_id = ?", [inspectionId]);
  if (!members.length) return;
  await executeStatement(
    `INSERT INTO asset_inspection_committee (inspection_id, seq, role, full_name, position) VALUES ${members.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
    members.flatMap((member) => [inspectionId, member.seq, member.role, member.fullName, member.position || null])
  );
}

export async function saveInspectionCommittee(inspectionId: number, members: CommitteeMember[]) {
  return withTransaction(() => writeCommittee(inspectionId, members));
}

/** เลขที่/วันที่คำสั่งแต่งตั้งคณะกรรมการ (printed on the report). Requires add_registry_completeness.sql. */
export async function saveCommitteeOrder(inspectionId: number, orderNo: string, orderDate: string) {
  await executeStatement(
    "UPDATE asset_inspections SET committee_order_no = ?, committee_order_date = ? WHERE id = ?",
    [orderNo.trim().slice(0, 100) || null, orderDate || null, inspectionId]
  );
}

export async function getInspectionCommittee(inspectionId: number): Promise<{ members: CommitteeMember[]; schemaReady: boolean }> {
  try {
    const rows = await selectRows<RowDataPacket & { seq: number; role: CommitteeMember["role"]; full_name: string; position: string | null }>(
      "SELECT seq, role, full_name, position FROM asset_inspection_committee WHERE inspection_id = ? ORDER BY seq",
      [inspectionId]
    );
    return { members: rows.map((row) => ({ seq: row.seq, role: row.role, fullName: row.full_name, position: row.position ?? "" })), schemaReady: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { members: [], schemaReady: false };
    throw error;
  }
}

export async function getInspectionItemContext(itemId: number): Promise<InspectionItemContext | null> {
  const rows = await selectRows<InspectionItemContextRow>(
    `SELECT aii.id, aii.inspection_id, ai.facility_id, aii.asset_id, ia.current_status, ia.work_group_id, ia.location_detail
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
    workGroupId: rows[0].work_group_id ?? null,
    locationDetail: rows[0].location_detail ?? "",
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
  if (input.foundWorkGroupId === undefined) return { foundSaved: false };
  try {
    await executeStatement(
      "UPDATE asset_inspection_items SET found_work_group_id = ?, found_location = ?, registered_work_group_id = ? WHERE id = ?",
      input.inspectionStatus === "Found"
        ? [input.foundWorkGroupId, input.foundLocation?.trim().slice(0, 255) || null, input.registeredWorkGroupId ?? null, input.itemId]
        : [null, null, input.registeredWorkGroupId ?? null, input.itemId]
    );
    return { foundSaved: true };
  } catch (error) {
    // Before add_inspection_found_location.sql the result is still saved, without the found location.
    if (isMissingSchemaError(error)) return { foundSaved: false };
    throw error;
  }
}

/**
 * Permanently deletes an inspection round and all of its item results. Asset records, their current
 * statuses and status history are not touched. Items are deleted explicitly (not only via FK cascade)
 * so the delete is complete even on databases created without the foreign key.
 */
export async function deleteInspection(inspectionId: number) {
  return withTransaction(async () => {
    const items = await executeStatement("DELETE FROM asset_inspection_items WHERE inspection_id = ?", [inspectionId]);
    const round = await executeStatement("DELETE FROM asset_inspections WHERE id = ?", [inspectionId]);
    if (round.affectedRows !== 1) throw new Error("ไม่พบรอบตรวจนับ หรือถูกลบไปแล้ว");
    return { deletedItems: items.affectedRows };
  });
}

/** Closing locks results; reopening is allowed for people who manage the round. */
export async function setInspectionRoundStatus(inspectionId: number, status: "Open" | "Closed", userName: string) {
  const result = await executeStatement(
    status === "Closed"
      ? "UPDATE asset_inspections SET round_status = 'Closed', closed_at = NOW(), closed_by = ? WHERE id = ? AND round_status <> 'Closed'"
      : "UPDATE asset_inspections SET round_status = 'Open', closed_at = NULL, closed_by = NULL WHERE id = ? AND round_status = 'Closed'",
    status === "Closed" ? [userName, inspectionId] : [inspectionId]
  );
  return result.affectedRows === 1;
}

export type OpenInspectionForAsset = {
  itemId: number;
  inspectionId: number;
  facilityId: number;
  roundName: string;
  inspectionStatus: InspectionItem["inspectionStatus"];
  assetStatus: string;
  checkedBy: string;
  checkedAt: string;
  foundWorkGroupId: number | null;
  foundLocation: string;
};

/** Open rounds that include this asset, newest first — used for one-tap check-in after scanning its QR. */
export async function listOpenInspectionsForAsset(assetId: number): Promise<OpenInspectionForAsset[]> {
  type Row = RowDataPacket & { id: number; inspection_id: number; facility_id: number; round_name: string; inspection_status: string | null; asset_status: string | null; checked_by: string | null; checked_at: Date | string | null; found_work_group_id?: number | null; found_location?: string | null };
  const query = (withStatus: boolean, withFound = withStatus) => selectRows<Row>(
    `SELECT aii.id, aii.inspection_id, ai.facility_id, ai.round_name, aii.inspection_status, aii.asset_status, aii.checked_by, aii.checked_at${withFound ? ", aii.found_work_group_id, aii.found_location" : ""}
     FROM asset_inspection_items aii
     JOIN asset_inspections ai ON ai.id = aii.inspection_id
     WHERE aii.asset_id = ?${withStatus ? " AND ai.round_status = 'Open'" : ""}
       AND (ai.end_date IS NULL OR ai.end_date >= CURDATE() - INTERVAL 30 DAY)
     ORDER BY ai.inspected_at DESC
     LIMIT 5`,
    [assetId]
  );
  try {
    const rows = await withSchemaFallback(() => query(true, true), () => withSchemaFallback(() => query(true, false), () => query(false, false)));
    return rows.map((row) => ({
      itemId: row.id,
      inspectionId: row.inspection_id,
      facilityId: row.facility_id,
      roundName: row.round_name,
      inspectionStatus: normalizeInspectionStatus(row.inspection_status),
      assetStatus: row.asset_status ?? "",
      checkedBy: row.checked_by ?? "",
      checkedAt: toDateTimeStr(row.checked_at),
      foundWorkGroupId: row.found_work_group_id ?? null,
      foundLocation: row.found_location ?? "",
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
}

export type AssetInspectionHistory = {
  inspectionId: number;
  roundName: string;
  startDate: string;
  inspectionStatus: InspectionItem["inspectionStatus"];
  assetStatus: string;
  conditionNote: string;
  checkedBy: string;
  checkedAt: string;
};

/** Every round that included this asset, newest first (for the asset card). */
export async function listInspectionHistoryForAsset(assetId: number): Promise<AssetInspectionHistory[]> {
  type Row = RowDataPacket & { inspection_id: number; round_name: string; start_date: Date | string | null; inspected_at: Date | string; inspection_status: string | null; asset_status: string | null; condition_note: string | null; checked_by: string | null; checked_at: Date | string | null };
  try {
    const rows = await selectRows<Row>(
      `SELECT aii.inspection_id, ai.round_name, ai.start_date, ai.inspected_at, aii.inspection_status, aii.asset_status, aii.condition_note, aii.checked_by, aii.checked_at
       FROM asset_inspection_items aii JOIN asset_inspections ai ON ai.id = aii.inspection_id
       WHERE aii.asset_id = ?
       ORDER BY COALESCE(ai.start_date, DATE(ai.inspected_at)) DESC, ai.id DESC
       LIMIT 50`,
      [assetId]
    );
    return rows.map((row) => ({
      inspectionId: row.inspection_id,
      roundName: row.round_name,
      startDate: toDateStr(row.start_date) || toDateStr(row.inspected_at),
      inspectionStatus: normalizeInspectionStatus(row.inspection_status),
      assetStatus: row.asset_status ?? "",
      conditionNote: row.condition_note ?? "",
      checkedBy: row.checked_by ?? "",
      checkedAt: toDateTimeStr(row.checked_at),
      foundWorkGroupId: row.found_work_group_id ?? null,
      foundLocation: row.found_location ?? "",
    }));
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
}
