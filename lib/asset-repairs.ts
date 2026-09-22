import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { isTerminalAssetStatus, OPERATIONAL_ASSET_STATUSES } from "@/lib/asset-status";
import { ensureAssetStatusHistoryTable, insertAssetStatusHistory } from "@/lib/asset-status-history";
import type { LifecycleList } from "@/lib/asset-transfers";
import { updateAsset } from "@/lib/assets";
import { executeStatement, selectRows, withTransaction } from "@/lib/mysql";
import {
  canTransitionRepair,
  REPAIR_PRIORITIES,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUSES,
  type RepairPriority,
  type RepairStatus,
} from "@/lib/repair-options";
import { isMissingSchemaError } from "@/lib/schema-errors";

export type Repair = {
  id: number;
  assetId: number;
  assetName: string;
  assetRegistrationNo: string;
  assetStatus: string;
  facilityId: number;
  facilityName: string;
  problem: string;
  priority: RepairPriority;
  status: RepairStatus;
  contact: string;
  reportedBy: string;
  reportedByUserId: number | null;
  reportedAt: string;
  statusBefore: string;
  assignedTo: string;
  vendorName: string;
  diagnosis: string;
  resolution: string;
  cost: number | null;
  startedAt: string;
  completedAt: string;
  updatedBy: string;
  updatedAt: string;
};

export type RepairLog = { id: number; fromStatus: RepairStatus | null; toStatus: RepairStatus; note: string; changedBy: string; changedAt: string };

type RepairRow = RowDataPacket & {
  id: number; asset_id: number; asset_name: string | null; asset_registration_no: string | null; current_status: string | null;
  facility_id: number; facility_name: string | null; problem: string; priority: RepairPriority; status: RepairStatus; contact: string | null;
  reported_by: string | null; reported_by_user_id: number | null; reported_at: Date | string; status_before: string | null;
  assigned_to: string | null; vendor_name: string | null; diagnosis: string | null; resolution: string | null; cost: string | number | null;
  started_at: Date | string | null; completed_at: Date | string | null; updated_by: string | null; updated_at: Date | string;
};

const dateTime = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 19).replace("T", " ") : "");

function toRepair(row: RepairRow): Repair {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name ?? "",
    assetRegistrationNo: row.asset_registration_no ?? "",
    assetStatus: row.current_status ?? "",
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "-",
    problem: row.problem,
    priority: row.priority,
    status: row.status,
    contact: row.contact ?? "",
    reportedBy: row.reported_by ?? "",
    reportedByUserId: row.reported_by_user_id,
    reportedAt: dateTime(row.reported_at),
    statusBefore: row.status_before ?? "",
    assignedTo: row.assigned_to ?? "",
    vendorName: row.vendor_name ?? "",
    diagnosis: row.diagnosis ?? "",
    resolution: row.resolution ?? "",
    cost: row.cost === null ? null : Number(row.cost),
    startedAt: dateTime(row.started_at),
    completedAt: dateTime(row.completed_at),
    updatedBy: row.updated_by ?? "",
    updatedAt: dateTime(row.updated_at),
  };
}

const REPAIR_SELECT = `
  SELECT r.*, a.asset_name, a.asset_registration_no, a.current_status, hf.name AS facility_name
  FROM asset_repairs r
  JOIN information_assets a ON a.id = r.asset_id
  LEFT JOIN health_facilities hf ON hf.id = r.facility_id`;

async function insertLog(repairId: number, fromStatus: RepairStatus | null, toStatus: RepairStatus, note: string | null, userId: number | null | undefined, userName: string) {
  await executeStatement(
    "INSERT INTO asset_repair_logs (repair_id, from_status, to_status, note, changed_by_user_id, changed_by) VALUES (?, ?, ?, ?, ?, ?)",
    [repairId, fromStatus, toStatus, note || null, userId ?? null, userName]
  );
}

export type CreateRepairInput = {
  assetId: number;
  problem: string;
  priority?: string;
  contact?: string;
  markBroken?: boolean;
  userId?: number | null;
  userName: string;
};

export async function createRepair(input: CreateRepairInput) {
  const problem = input.problem.trim();
  if (!problem) throw new Error("กรุณาระบุอาการเสีย/ปัญหา");
  if (problem.length > 2000) throw new Error("รายละเอียดปัญหายาวเกิน 2,000 ตัวอักษร");
  const priority = (input.priority || "Normal") as RepairPriority;
  if (!REPAIR_PRIORITIES.includes(priority)) throw new Error("ระดับความเร่งด่วนไม่ถูกต้อง");
  await ensureAssetStatusHistoryTable();

  return withTransaction(async () => {
    const [asset] = await selectRows<RowDataPacket & { facility_id: number; current_status: string | null }>(
      `SELECT s.facility_id, a.current_status FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id WHERE a.id = ? FOR UPDATE`,
      [input.assetId]
    );
    if (!asset) throw new Error("ไม่พบทรัพย์สิน");
    if (isTerminalAssetStatus(asset.current_status)) throw new Error("ทรัพย์สินที่จำหน่ายหรือสูญหายแล้วแจ้งซ่อมไม่ได้");

    // The asset row lock above serialises concurrent reports, so this check cannot race.
    const [open] = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM asset_repairs WHERE asset_id = ? AND status IN ('Reported','InProgress','SentToVendor') LIMIT 1",
      [input.assetId]
    );
    if (open) throw new Error(`ทรัพย์สินนี้มีงานซ่อมที่ยังไม่ปิดอยู่แล้ว (#${open.id})`);

    let repairId: number;
    try {
      const result = await executeStatement(
        `INSERT INTO asset_repairs (asset_id, facility_id, problem, priority, contact, reported_by_user_id, reported_by, status_before, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.assetId, asset.facility_id, problem, priority, input.contact?.trim() || null, input.userId ?? null, input.userName, asset.current_status, input.userName]
      );
      repairId = result.insertId;
    } catch (error) {
      throw error;
    }
    await insertLog(repairId, null, "Reported", problem, input.userId, input.userName);

    if (input.markBroken && asset.current_status !== "Broken") {
      await updateAsset(input.assetId, { currentStatus: "Broken", updatedBy: input.userName, lastUpdatedAt: new Date().toISOString().slice(0, 10) });
      await insertAssetStatusHistory({ assetId: input.assetId, fromStatus: asset.current_status, toStatus: "Broken", note: `[แจ้งซ่อม #${repairId}] ${problem}`, changedByUserId: input.userId ?? null, changedBy: input.userName });
    }
    return { repairId, facilityId: Number(asset.facility_id) };
  });
}

export type UpdateRepairInput = {
  repairId: number;
  toStatus: string;
  assignedTo?: string;
  vendorName?: string;
  diagnosis?: string;
  resolution?: string;
  cost?: number | null;
  note?: string;
  /** Asset status to set when the job closes; undefined keeps the current status. */
  assetOutcome?: string;
  userId?: number | null;
  userName: string;
};

export async function updateRepair(input: UpdateRepairInput) {
  const toStatus = input.toStatus as RepairStatus;
  if (!REPAIR_STATUSES.includes(toStatus)) throw new Error("สถานะงานซ่อมไม่ถูกต้อง");
  if (input.cost != null && (!Number.isFinite(input.cost) || input.cost < 0)) throw new Error("ค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ");
  if (input.assetOutcome && !(OPERATIONAL_ASSET_STATUSES as readonly string[]).includes(input.assetOutcome)) throw new Error("สถานะทรัพย์สินหลังซ่อมไม่ถูกต้อง");
  await ensureAssetStatusHistoryTable();

  return withTransaction(async () => {
    const [repair] = await selectRows<RepairRow>("SELECT * FROM asset_repairs WHERE id = ? FOR UPDATE", [input.repairId]);
    if (!repair) throw new Error("ไม่พบงานซ่อม");
    if (!canTransitionRepair(repair.status, toStatus)) {
      throw new Error(`เปลี่ยนสถานะจาก "${REPAIR_STATUS_LABELS[repair.status]}" เป็น "${REPAIR_STATUS_LABELS[toStatus]}" ไม่ได้`);
    }
    if (toStatus === "Completed" && !(input.resolution ?? repair.resolution)?.trim()) throw new Error("กรุณาระบุผลการซ่อมก่อนปิดงาน");

    const sets: string[] = ["status = ?", "updated_by = ?"];
    const values: unknown[] = [toStatus, input.userName];
    const optional: Array<[string, unknown]> = [
      ["assigned_to", input.assignedTo], ["vendor_name", input.vendorName], ["diagnosis", input.diagnosis], ["resolution", input.resolution],
    ];
    for (const [column, value] of optional) {
      if (value === undefined) continue;
      sets.push(`${column} = ?`);
      values.push(String(value).trim() || null);
    }
    if (input.cost !== undefined) { sets.push("cost = ?"); values.push(input.cost); }
    if ((toStatus === "InProgress" || toStatus === "SentToVendor") && !repair.started_at) sets.push("started_at = NOW()");
    if (toStatus === "Completed" || toStatus === "Cancelled") sets.push("completed_at = NOW()");
    values.push(input.repairId);
    await executeStatement(`UPDATE asset_repairs SET ${sets.join(", ")} WHERE id = ?`, values);

    const changed = repair.status !== toStatus;
    if (changed || input.note?.trim()) await insertLog(input.repairId, repair.status, toStatus, input.note?.trim() || null, input.userId, input.userName);

    const closing = changed && (toStatus === "Completed" || toStatus === "Cancelled");
    if (closing && input.assetOutcome) {
      const [asset] = await selectRows<RowDataPacket & { current_status: string | null }>("SELECT current_status FROM information_assets WHERE id = ? FOR UPDATE", [repair.asset_id]);
      if (asset && !isTerminalAssetStatus(asset.current_status) && asset.current_status !== input.assetOutcome) {
        await updateAsset(repair.asset_id, { currentStatus: input.assetOutcome, updatedBy: input.userName, lastUpdatedAt: new Date().toISOString().slice(0, 10) });
        await insertAssetStatusHistory({
          assetId: repair.asset_id,
          fromStatus: asset.current_status,
          toStatus: input.assetOutcome,
          note: `[${REPAIR_STATUS_LABELS[toStatus]} #${input.repairId}] ${(input.resolution ?? repair.resolution ?? input.note ?? "").trim()}`.trim(),
          changedByUserId: input.userId ?? null,
          changedBy: input.userName,
        });
      }
    }
    return { assetId: repair.asset_id, facilityId: Number(repair.facility_id), fromStatus: repair.status, toStatus };
  });
}

export async function getRepair(id: number) {
  const rows = await selectRows<RepairRow>(`${REPAIR_SELECT} WHERE r.id = ?`, [id]);
  return rows[0] ? toRepair(rows[0]) : null;
}

export async function listRepairLogs(repairId: number): Promise<RepairLog[]> {
  const rows = await selectRows<RowDataPacket & { id: number; from_status: RepairStatus | null; to_status: RepairStatus; note: string | null; changed_by: string | null; changed_at: Date | string }>(
    "SELECT id, from_status, to_status, note, changed_by, changed_at FROM asset_repair_logs WHERE repair_id = ? ORDER BY changed_at, id",
    [repairId]
  );
  return rows.map(row => ({ id: row.id, fromStatus: row.from_status, toStatus: row.to_status, note: row.note ?? "", changedBy: row.changed_by ?? "", changedAt: dateTime(row.changed_at) }));
}

export type RepairFilter = { facilityIds?: number[]; status?: RepairStatus | "open"; assetId?: number; dateFrom?: string; dateTo?: string; limit?: number };

function buildRepairWhere(filter: RepairFilter) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter.facilityIds) { conditions.push(`r.facility_id IN (${filter.facilityIds.map(() => "?").join(",")})`); values.push(...filter.facilityIds); }
  if (filter.status === "open") conditions.push("r.status IN ('Reported','InProgress','SentToVendor')");
  else if (filter.status) { conditions.push("r.status = ?"); values.push(filter.status); }
  if (filter.assetId) { conditions.push("r.asset_id = ?"); values.push(filter.assetId); }
  if (filter.dateFrom) { conditions.push("r.reported_at >= ?"); values.push(`${filter.dateFrom} 00:00:00`); }
  if (filter.dateTo) { conditions.push("r.reported_at <= ?"); values.push(`${filter.dateTo} 23:59:59`); }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", values };
}

export async function listRepairs(filter: RepairFilter): Promise<LifecycleList<Repair>> {
  if (filter.facilityIds && filter.facilityIds.length === 0) return { rows: [], schemaReady: true };
  const { where, values } = buildRepairWhere(filter);
  const limit = Math.min(Math.max(Math.floor(filter.limit ?? 200), 1), 2000);
  try {
    const rows = await selectRows<RepairRow>(
      `${REPAIR_SELECT} ${where}
       ORDER BY (r.status IN ('Reported','InProgress','SentToVendor')) DESC, FIELD(r.priority, 'Urgent', 'High', 'Normal', 'Low'), r.reported_at DESC, r.id DESC
       LIMIT ${limit}`,
      values
    );
    return { rows: rows.map(toRepair), schemaReady: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], schemaReady: false };
    throw error;
  }
}

export type RepairSummary = {
  schemaReady: boolean;
  byStatus: Record<RepairStatus, number>;
  open: number;
  totalCost: number;
  completedCount: number;
  averageDaysToComplete: number | null;
  frequentAssets: Array<{ assetId: number; assetName: string; assetRegistrationNo: string; count: number; cost: number }>;
};

/** Counts jobs reported in the date range (all dates when omitted). */
export async function summarizeRepairs(filter: Omit<RepairFilter, "status" | "limit">): Promise<RepairSummary> {
  const empty: RepairSummary = { schemaReady: true, byStatus: { Reported: 0, InProgress: 0, SentToVendor: 0, Completed: 0, Cancelled: 0 }, open: 0, totalCost: 0, completedCount: 0, averageDaysToComplete: null, frequentAssets: [] };
  if (filter.facilityIds && filter.facilityIds.length === 0) return empty;
  const { where, values } = buildRepairWhere(filter);
  try {
    const statusRows = await selectRows<RowDataPacket & { status: RepairStatus; n: number; cost: string | number | null; avg_days: string | number | null }>(
      `SELECT r.status, COUNT(*) AS n, SUM(COALESCE(r.cost, 0)) AS cost,
              AVG(CASE WHEN r.status = 'Completed' THEN TIMESTAMPDIFF(HOUR, r.reported_at, r.completed_at) / 24 END) AS avg_days
       FROM asset_repairs r ${where} GROUP BY r.status`,
      values
    );
    const summary = { ...empty, byStatus: { ...empty.byStatus } };
    for (const row of statusRows) {
      summary.byStatus[row.status] = Number(row.n);
      if (row.status !== "Cancelled") summary.totalCost += Number(row.cost ?? 0);
      if (row.status === "Completed") {
        summary.completedCount = Number(row.n);
        summary.averageDaysToComplete = row.avg_days === null ? null : Math.round(Number(row.avg_days) * 10) / 10;
      }
    }
    summary.open = summary.byStatus.Reported + summary.byStatus.InProgress + summary.byStatus.SentToVendor;
    summary.totalCost = Math.round(summary.totalCost * 100) / 100;
    const frequent = await selectRows<RowDataPacket & { asset_id: number; asset_name: string; asset_registration_no: string | null; n: number; cost: string | number | null }>(
      `SELECT r.asset_id, a.asset_name, a.asset_registration_no, COUNT(*) AS n, SUM(COALESCE(r.cost, 0)) AS cost
       FROM asset_repairs r JOIN information_assets a ON a.id = r.asset_id
       ${where ? `${where} AND` : "WHERE"} r.status <> 'Cancelled'
       GROUP BY r.asset_id, a.asset_name, a.asset_registration_no
       HAVING COUNT(*) >= 2
       ORDER BY n DESC, cost DESC
       LIMIT 10`,
      values
    );
    summary.frequentAssets = frequent.map(row => ({ assetId: row.asset_id, assetName: row.asset_name, assetRegistrationNo: row.asset_registration_no ?? "", count: Number(row.n), cost: Number(row.cost ?? 0) }));
    return summary;
  } catch (error) {
    if (isMissingSchemaError(error)) return { ...empty, schemaReady: false };
    throw error;
  }
}
