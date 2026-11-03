import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { dbDate } from "@/lib/local-date";
import { selectRows } from "@/lib/mysql";

type Row = RowDataPacket & { asset_id: number; disposed_on: Date | string | null };

const isMissing = (error: unknown, code: string) => (error as { code?: string } | null)?.code === code;

async function loadDates(ids: number[]) {
  const placeholders = ids.map(() => "?").join(", ");
  const query = (dateExpr: string) =>
    selectRows<Row>(
      `SELECT asset_id, MAX(${dateExpr}) AS disposed_on
       FROM asset_disposal_requests
       WHERE status = 'Approved' AND asset_id IN (${placeholders})
       GROUP BY asset_id`,
      ids
    );
  try {
    return await query("COALESCE(executed_on, DATE(decided_at))");
  } catch (error) {
    if (isMissing(error, "ER_NO_SUCH_TABLE")) return [];
    if (!isMissing(error, "ER_BAD_FIELD_ERROR")) throw error;
    return query("DATE(decided_at)"); // executed_on not migrated yet
  }
}

/**
 * Adds `disposedOn` to Disposed/Lost assets: the execution date of the approved disposal request,
 * otherwise its approval date. Used by period reports so later disposals do not rewrite past years.
 */
export async function attachDisposalDates<T extends { id: number; currentStatus?: string }>(assets: T[]): Promise<Array<T & { disposedOn?: string | null }>> {
  const ids = assets.filter((a) => a.currentStatus === "Disposed" || a.currentStatus === "Lost").map((a) => a.id);
  if (ids.length === 0) return assets;
  const dates = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    for (const row of await loadDates(ids.slice(i, i + 1000))) {
      const day = dbDate(row.disposed_on);
      if (day) dates.set(Number(row.asset_id), day);
    }
  }
  return assets.map((asset) => (dates.has(asset.id) ? { ...asset, disposedOn: dates.get(asset.id) } : asset));
}
