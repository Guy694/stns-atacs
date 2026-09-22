import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { selectRows } from "@/lib/mysql";
import type { RepairStats } from "@/lib/replacement-plan";
import { isMissingSchemaError } from "@/lib/schema-errors";

function scope(column: string, facilityIds?: number[]) {
  if (!facilityIds) return { sql: "", values: [] as unknown[] };
  if (!facilityIds.length) return { sql: " AND 1 = 0", values: [] as unknown[] };
  return { sql: ` AND ${column} IN (${facilityIds.map(() => "?").join(",")})`, values: facilityIds as unknown[] };
}

/** Repairs per asset: count since `since`, all-time count and all-time cost (cancelled jobs excluded). */
export async function getRepairStats(since: string, facilityIds?: number[]): Promise<Map<number, RepairStats>> {
  const where = scope("r.facility_id", facilityIds);
  try {
    const rows = await selectRows<RowDataPacket & { asset_id: number; recent: number; total: number; cost: string | number | null }>(
      `SELECT r.asset_id,
         SUM(CASE WHEN r.reported_at >= ? THEN 1 ELSE 0 END) AS recent,
         COUNT(*) AS total,
         COALESCE(SUM(r.cost), 0) AS cost
       FROM asset_repairs r
       WHERE r.status <> 'Cancelled'${where.sql}
       GROUP BY r.asset_id`,
      [since, ...where.values]
    );
    return new Map(rows.map((row) => [Number(row.asset_id), { recentCount: Number(row.recent ?? 0), totalCount: Number(row.total ?? 0), totalCost: Number(row.cost ?? 0) }]));
  } catch (error) {
    if (isMissingSchemaError(error)) return new Map();
    throw error;
  }
}

export async function getPendingDisposalAssetIds(facilityIds?: number[]): Promise<Set<number>> {
  const where = scope("d.facility_id", facilityIds);
  try {
    const rows = await selectRows<RowDataPacket & { asset_id: number }>(
      `SELECT DISTINCT d.asset_id FROM asset_disposal_requests d WHERE d.status = 'Pending'${where.sql}`,
      where.values
    );
    return new Set(rows.map((row) => Number(row.asset_id)));
  } catch (error) {
    if (isMissingSchemaError(error)) return new Set();
    throw error;
  }
}
