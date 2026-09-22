import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { isTerminalAssetStatus } from "@/lib/asset-status";
import { ensureAssetStatusHistoryTable, insertAssetStatusHistory } from "@/lib/asset-status-history";
import { updateAsset } from "@/lib/assets";
import { executeStatement, selectRows, withTransaction } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

export type TransferInput = {
  assetId: number;
  toSurveyId: number;
  /** undefined keeps the current work group (same facility only); null clears it. */
  toWorkGroupId?: number | null;
  toOwnerName?: string;
  toLocationDetail?: string;
  reason?: string;
  documentNo?: string;
  transferDate: string;
  userId?: number | null;
  userName: string;
};

export type AssetTransfer = {
  id: number;
  assetId: number;
  assetName: string;
  assetRegistrationNo: string;
  fromFacilityId: number | null;
  fromFacilityName: string;
  toFacilityId: number;
  toFacilityName: string;
  fromWorkGroupName: string;
  toWorkGroupName: string;
  fromOwnerName: string;
  toOwnerName: string;
  fromLocationDetail: string;
  toLocationDetail: string;
  reason: string;
  documentNo: string;
  transferDate: string;
  transferredBy: string;
  createdAt: string;
};

type LockedAsset = RowDataPacket & {
  id: number;
  asset_name: string;
  survey_id: number;
  facility_id: number;
  facility_name: string | null;
  work_group_id: number | null;
  owner_name: string | null;
  location_detail: string | null;
  current_status: string | null;
};

const dateOnly = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10) : "");
const dateTime = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 19).replace("T", " ") : "");

/** Moves an asset and records the transfer, status history and new placement atomically. */
export async function transferAsset(input: TransferInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate)) throw new Error("วันที่โอนย้ายไม่ถูกต้อง");
  if (input.transferDate > new Date().toISOString().slice(0, 10)) throw new Error("วันที่โอนย้ายห้ามเกินวันที่ปัจจุบัน");
  await ensureAssetStatusHistoryTable();

  return withTransaction(async () => {
    const [asset] = await selectRows<LockedAsset>(
      `SELECT a.id, a.asset_name, a.survey_id, s.facility_id, hf.name AS facility_name, a.work_group_id, a.owner_name, a.location_detail, a.current_status
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
       LEFT JOIN health_facilities hf ON hf.id = s.facility_id
       WHERE a.id = ? FOR UPDATE`,
      [input.assetId]
    );
    if (!asset) throw new Error("ไม่พบทรัพย์สิน");
    if (isTerminalAssetStatus(asset.current_status)) throw new Error("ทรัพย์สินที่จำหน่ายหรือสูญหายแล้วโอนย้ายไม่ได้");

    const [destination] = await selectRows<RowDataPacket & { facility_id: number; facility_name: string | null }>(
      `SELECT s.facility_id, hf.name AS facility_name
       FROM information_asset_surveys s LEFT JOIN health_facilities hf ON hf.id = s.facility_id
       WHERE s.id = ?`,
      [input.toSurveyId]
    );
    if (!destination) throw new Error("ไม่พบหน่วยงานปลายทาง");
    const facilityChanged = Number(destination.facility_id) !== Number(asset.facility_id);

    let toWorkGroupId = input.toWorkGroupId === undefined ? (facilityChanged ? null : asset.work_group_id) : input.toWorkGroupId;
    const activeGroups = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM facility_work_groups WHERE facility_id = ? AND is_active = 1",
      [destination.facility_id]
    );
    if (toWorkGroupId !== null && !activeGroups.some(group => Number(group.id) === Number(toWorkGroupId))) {
      if (input.toWorkGroupId !== undefined) throw new Error("กลุ่มงานไม่อยู่ในหน่วยงานปลายทาง");
      toWorkGroupId = null;
    }
    if (activeGroups.length > 0 && toWorkGroupId === null) throw new Error("กรุณาเลือกกลุ่มงานของหน่วยงานปลายทาง");

    const toOwnerName = input.toOwnerName ?? asset.owner_name ?? "";
    const toLocationDetail = input.toLocationDetail ?? asset.location_detail ?? "";
    const unchanged = !facilityChanged && Number(input.toSurveyId) === Number(asset.survey_id)
      && Number(toWorkGroupId ?? 0) === Number(asset.work_group_id ?? 0)
      && toOwnerName === (asset.owner_name ?? "") && toLocationDetail === (asset.location_detail ?? "");
    if (unchanged) throw new Error("ข้อมูลปลายทางเหมือนตำแหน่งปัจจุบัน ไม่มีการโอนย้าย");

    // usage_description is intentionally untouched: the transfer lives in its own history table.
    await updateAsset(input.assetId, {
      surveyId: input.toSurveyId,
      workGroupId: toWorkGroupId,
      ownerName: toOwnerName,
      locationDetail: toLocationDetail,
      updatedBy: input.userName,
      lastUpdatedAt: new Date().toISOString().slice(0, 10),
    });

    const result = await executeStatement(
      `INSERT INTO asset_transfers
        (asset_id, from_survey_id, to_survey_id, from_facility_id, to_facility_id, from_work_group_id, to_work_group_id,
         from_owner_name, to_owner_name, from_location_detail, to_location_detail, reason, document_no, transfer_date,
         transferred_by_user_id, transferred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.assetId, asset.survey_id, input.toSurveyId, asset.facility_id, destination.facility_id,
        asset.work_group_id, toWorkGroupId, asset.owner_name, toOwnerName || null, asset.location_detail, toLocationDetail || null,
        input.reason || null, input.documentNo || null, input.transferDate, input.userId ?? null, input.userName,
      ]
    );

    const note = `[โอนย้าย] ${asset.facility_name ?? "-"} → ${destination.facility_name ?? "-"}${input.reason ? ` — ${input.reason}` : ""}`;
    await insertAssetStatusHistory({
      assetId: input.assetId,
      fromStatus: asset.current_status,
      toStatus: asset.current_status ?? "Active",
      note,
      changedByUserId: input.userId ?? null,
      changedBy: input.userName,
    });

    return { transferId: result.insertId, note, fromFacilityId: Number(asset.facility_id), toFacilityId: Number(destination.facility_id) };
  });
}

type TransferRow = RowDataPacket & {
  id: number; asset_id: number; asset_name: string | null; asset_registration_no: string | null;
  from_facility_id: number | null; from_facility_name: string | null; to_facility_id: number; to_facility_name: string | null;
  from_work_group_name: string | null; to_work_group_name: string | null;
  from_owner_name: string | null; to_owner_name: string | null; from_location_detail: string | null; to_location_detail: string | null;
  reason: string | null; document_no: string | null; transfer_date: Date | string; transferred_by: string | null; created_at: Date | string;
};

const TRANSFER_SELECT = `
  SELECT t.*, a.asset_name, a.asset_registration_no,
         fh.name AS from_facility_name, th.name AS to_facility_name,
         fw.work_group_name AS from_work_group_name, tw.work_group_name AS to_work_group_name
  FROM asset_transfers t
  JOIN information_assets a ON a.id = t.asset_id
  LEFT JOIN health_facilities fh ON fh.id = t.from_facility_id
  LEFT JOIN health_facilities th ON th.id = t.to_facility_id
  LEFT JOIN facility_work_groups fw ON fw.id = t.from_work_group_id
  LEFT JOIN facility_work_groups tw ON tw.id = t.to_work_group_id`;

function toTransfer(row: TransferRow): AssetTransfer {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name ?? "",
    assetRegistrationNo: row.asset_registration_no ?? "",
    fromFacilityId: row.from_facility_id,
    fromFacilityName: row.from_facility_name ?? "-",
    toFacilityId: row.to_facility_id,
    toFacilityName: row.to_facility_name ?? "-",
    fromWorkGroupName: row.from_work_group_name ?? "",
    toWorkGroupName: row.to_work_group_name ?? "",
    fromOwnerName: row.from_owner_name ?? "",
    toOwnerName: row.to_owner_name ?? "",
    fromLocationDetail: row.from_location_detail ?? "",
    toLocationDetail: row.to_location_detail ?? "",
    reason: row.reason ?? "",
    documentNo: row.document_no ?? "",
    transferDate: dateOnly(row.transfer_date),
    transferredBy: row.transferred_by ?? "",
    createdAt: dateTime(row.created_at),
  };
}

export type LifecycleList<T> = { rows: T[]; schemaReady: boolean };

export async function listAssetTransfers(assetId: number): Promise<LifecycleList<AssetTransfer>> {
  try {
    const rows = await selectRows<TransferRow>(`${TRANSFER_SELECT} WHERE t.asset_id = ? ORDER BY t.transfer_date DESC, t.id DESC`, [assetId]);
    return { rows: rows.map(toTransfer), schemaReady: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], schemaReady: false };
    throw error;
  }
}

/** facilityIds undefined = all facilities (admin); an empty list returns nothing. */
export async function listTransfers(filter: { facilityIds?: number[]; dateFrom?: string; dateTo?: string; limit?: number }): Promise<LifecycleList<AssetTransfer>> {
  if (filter.facilityIds && filter.facilityIds.length === 0) return { rows: [], schemaReady: true };
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter.facilityIds) {
    const marks = filter.facilityIds.map(() => "?").join(",");
    conditions.push(`(t.from_facility_id IN (${marks}) OR t.to_facility_id IN (${marks}))`);
    values.push(...filter.facilityIds, ...filter.facilityIds);
  }
  if (filter.dateFrom) { conditions.push("t.transfer_date >= ?"); values.push(filter.dateFrom); }
  if (filter.dateTo) { conditions.push("t.transfer_date <= ?"); values.push(filter.dateTo); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Math.floor(filter.limit ?? 100), 1), 1000);
  try {
    const rows = await selectRows<TransferRow>(`${TRANSFER_SELECT} ${where} ORDER BY t.transfer_date DESC, t.id DESC LIMIT ${limit}`, values);
    return { rows: rows.map(toTransfer), schemaReady: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], schemaReady: false };
    throw error;
  }
}
