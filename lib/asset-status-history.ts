import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";

let historyTableReady = false;

async function ensureAssetStatusHistoryTable() {
  if (historyTableReady) return;

  await executeStatement(`
    CREATE TABLE IF NOT EXISTS asset_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asset_id INT NOT NULL,
      from_status VARCHAR(100) NULL,
      to_status VARCHAR(100) NOT NULL,
      note TEXT NULL,
      changed_by_user_id INT NULL,
      changed_by VARCHAR(255) NULL,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_asset_status_history_asset_changed (asset_id, changed_at),
      CONSTRAINT fk_asset_status_history_asset
        FOREIGN KEY (asset_id) REFERENCES information_assets(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  historyTableReady = true;
}

type AssetStatusHistoryRow = RowDataPacket & {
  id: number;
  asset_id: number;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by_user_id: number | null;
  changed_by: string | null;
  changed_at: Date | string;
};

export type AssetStatusHistory = {
  id: number;
  assetId: number;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  changedByUserId: number | null;
  changedBy: string;
  changedAt: string;
};

function toDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 19).replace("T", " ");
}

export async function recordAssetStatusHistory(input: {
  assetId: number;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  changedByUserId?: number | null;
  changedBy?: string | null;
}) {
  await ensureAssetStatusHistoryTable();

  await executeStatement(
    `INSERT INTO asset_status_history
      (asset_id, from_status, to_status, note, changed_by_user_id, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.assetId,
      input.fromStatus ?? null,
      input.toStatus,
      input.note ?? null,
      input.changedByUserId ?? null,
      input.changedBy ?? null,
    ]
  );
}

export async function listAssetStatusHistory(assetId: number): Promise<AssetStatusHistory[]> {
  await ensureAssetStatusHistoryTable();

  const rows = await selectRows<AssetStatusHistoryRow>(
    `SELECT id, asset_id, from_status, to_status, note, changed_by_user_id, changed_by, changed_at
     FROM asset_status_history
     WHERE asset_id = ?
     ORDER BY changed_at DESC, id DESC`,
    [assetId]
  );

  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note ?? "",
    changedByUserId: row.changed_by_user_id,
    changedBy: row.changed_by ?? "",
    changedAt: toDateTime(row.changed_at),
  }));
}
