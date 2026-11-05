import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

export type OpenAssetWork = {
  openRepairs: number;
  openLoans: number;
  pendingDisposals: number;
  /** Approved disposals whose sale/transfer/destruction has not been recorded yet. */
  awaitingExecution: number;
};

/** Work still open on an asset. Tables or columns that are not migrated yet count as nothing open. */
export async function countOpenAssetWork(assetId: number, options: { includeAwaitingExecution?: boolean } = {}): Promise<OpenAssetWork> {
  const work: OpenAssetWork = { openRepairs: 0, openLoans: 0, pendingDisposals: 0, awaitingExecution: 0 };
  try {
    const [counts] = await selectRows<RowDataPacket & { open_repairs: number; open_loans: number; pending_disposals: number }>(
      `SELECT
         (SELECT COUNT(*) FROM asset_repairs WHERE asset_id = ? AND status IN ('Reported','InProgress','SentToVendor')) AS open_repairs,
         (SELECT COUNT(*) FROM asset_loans WHERE asset_id = ? AND status = 'OnLoan') AS open_loans,
         (SELECT COUNT(*) FROM asset_disposal_requests WHERE asset_id = ? AND status = 'Pending') AS pending_disposals`,
      [assetId, assetId, assetId]
    );
    work.openRepairs = Number(counts?.open_repairs ?? 0);
    work.openLoans = Number(counts?.open_loans ?? 0);
    work.pendingDisposals = Number(counts?.pending_disposals ?? 0);
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error; // lifecycle tables not migrated yet: nothing can be open
  }
  if (options.includeAwaitingExecution) {
    try {
      const [row] = await selectRows<RowDataPacket & { awaiting_execution: number }>(
        `SELECT COUNT(*) AS awaiting_execution FROM asset_disposal_requests
         WHERE asset_id = ? AND status = 'Approved' AND request_type = 'Disposed' AND executed_on IS NULL`,
        [assetId]
      );
      work.awaitingExecution = Number(row?.awaiting_execution ?? 0);
    } catch (error) {
      if (!isMissingSchemaError(error)) throw error; // executed_on arrives with add_registry_completeness.sql
    }
  }
  return work;
}

export function describeOpenAssetWork(work: OpenAssetWork) {
  return [
    work.openRepairs > 0 ? `งานซ่อมที่ยังไม่ปิด ${work.openRepairs} รายการ` : "",
    work.openLoans > 0 ? `กำลังถูกยืม ${work.openLoans} รายการ` : "",
    work.pendingDisposals > 0 ? `คำขอจำหน่ายที่รอพิจารณา ${work.pendingDisposals} รายการ` : "",
    work.awaitingExecution > 0 ? `การจำหน่ายที่อนุมัติแล้วแต่ยังไม่บันทึกผลการดำเนินการ ${work.awaitingExecution} รายการ` : "",
  ].filter(Boolean);
}

/**
 * Repairs, loans and disposal requests keep the facility they were opened under, so moving or deleting
 * an asset with open work would hide that work (or leave it acting on an asset nobody can see).
 */
export async function assertNoOpenAssetWork(assetId: number, purpose: "transfer" | "delete") {
  const open = describeOpenAssetWork(await countOpenAssetWork(assetId, { includeAwaitingExecution: purpose === "delete" }));
  if (!open.length) return;
  const action = purpose === "transfer" ? "โอนย้ายข้ามหน่วยงานไม่ได้" : "ลบทรัพย์สินไม่ได้";
  throw new Error(`${action} เพราะยังมี${open.join(", ")} กรุณาปิดงานเหล่านี้ก่อน`);
}
