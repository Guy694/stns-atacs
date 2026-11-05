import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { selectRows } from "@/lib/mysql";

/**
 * Soft delete of register entries (database/add_asset_soft_delete.sql adds
 * information_assets.deleted_at / deleted_by_user_id / deleted_by).
 *
 * Every user-facing read that lists, counts or looks up assets must add
 * `await assetNotDeletedSql("a")` to its WHERE (or to the ON of a LEFT JOIN).
 * Before the migration runs the helper returns "1=1", so no query breaks.
 * History lists (loans, repairs, transfers, disposals, audit) intentionally keep rows of deleted assets.
 */

const RECHECK_MISSING_MS = 60_000;
let columnExists: boolean | undefined;
let checkedAt = 0;

export async function hasAssetSoftDelete(): Promise<boolean> {
  // Once present the column never disappears; a missing column is re-checked so the migration is picked up without a restart.
  if (columnExists === true) return true;
  if (columnExists === false && Date.now() - checkedAt < RECHECK_MISSING_MS) return false;
  try {
    const rows = await selectRows<RowDataPacket & { n: number }>(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'deleted_at'`
    );
    columnExists = Number(rows[0]?.n ?? 0) > 0;
  } catch {
    columnExists = false;
  }
  checkedAt = Date.now();
  return columnExists;
}

/** SQL condition "this asset row is not soft-deleted" for the given table alias ("1=1" before the migration). */
export async function assetNotDeletedSql(alias = "a") {
  return (await hasAssetSoftDelete()) ? `${alias}.deleted_at IS NULL` : "1=1";
}

/** SQL condition for a row that only carries an asset id (e.g. inspection items): its asset is not soft-deleted. */
export async function assetIdNotDeletedSql(assetIdColumn: string) {
  return (await hasAssetSoftDelete())
    ? `NOT EXISTS (SELECT 1 FROM information_assets deleted_asset WHERE deleted_asset.id = ${assetIdColumn} AND deleted_asset.deleted_at IS NOT NULL)`
    : "1=1";
}

export const ASSET_SOFT_DELETE_MIGRATION_MESSAGE =
  "ฐานข้อมูลยังไม่รองรับการลบแบบเก็บประวัติ กรุณาให้ผู้ดูแลระบบรัน database/add_asset_soft_delete.sql ก่อน";
