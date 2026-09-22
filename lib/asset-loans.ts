import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { formatAssetNumber } from "@/lib/asset-number";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { ensureAssetStatusHistoryTable, insertAssetStatusHistory } from "@/lib/asset-status-history";
import type { LifecycleList } from "@/lib/asset-transfers";
import { updateAsset } from "@/lib/assets";
import { RETURN_CONDITION_LABELS, validateLoanInput, validateReturn, type LoanInput, type LoanStatus, type ReturnCondition } from "@/lib/loan-options";
import { executeStatement, selectRows, withTransaction } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

export type AssetLoan = {
  id: number;
  assetId: number;
  assetName: string;
  assetNumber: string;
  facilityId: number;
  facilityName: string;
  borrowerName: string;
  borrowerUnit: string;
  borrowerContact: string;
  purpose: string;
  loanedOn: string;
  dueOn: string;
  status: LoanStatus;
  returnedOn: string;
  returnCondition: ReturnCondition | null;
  returnNote: string;
  createdBy: string;
  returnedBy: string;
};

type LoanRow = RowDataPacket & {
  id: number; asset_id: number; asset_name: string | null; asset_registration_no: string | null; asset_code_prefix?: string | null;
  facility_id: number; facility_name: string | null; borrower_name: string; borrower_unit: string | null; borrower_contact: string | null;
  purpose: string; loaned_on: Date | string; due_on: Date | string; status: LoanStatus; returned_on: Date | string | null;
  return_condition: ReturnCondition | null; return_note: string | null; created_by: string | null; returned_by: string | null;
};

const day = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10) : "");

function toLoan(row: LoanRow): AssetLoan {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name ?? "",
    assetNumber: formatAssetNumber(row.asset_code_prefix, row.asset_registration_no) || "-",
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "-",
    borrowerName: row.borrower_name,
    borrowerUnit: row.borrower_unit ?? "",
    borrowerContact: row.borrower_contact ?? "",
    purpose: row.purpose,
    loanedOn: day(row.loaned_on),
    dueOn: day(row.due_on),
    status: row.status,
    returnedOn: day(row.returned_on),
    returnCondition: row.return_condition,
    returnNote: row.return_note ?? "",
    createdBy: row.created_by ?? "",
    returnedBy: row.returned_by ?? "",
  };
}

// a.* brings asset_code_prefix when that migration exists; loan columns are aliased after it so they win.
const LOAN_SELECT = `
  SELECT a.asset_name, a.asset_registration_no, a.*, l.*, hf.name AS facility_name
  FROM asset_loans l
  JOIN information_assets a ON a.id = l.asset_id
  LEFT JOIN health_facilities hf ON hf.id = l.facility_id`;

export type CreateLoanInput = LoanInput & { assetId: number; userId: number; userName: string };

export async function createLoan(input: CreateLoanInput) {
  const loan = validateLoanInput(input);
  await ensureAssetStatusHistoryTable();
  return withTransaction(async () => {
    const [asset] = await selectRows<RowDataPacket & { facility_id: number; current_status: string | null }>(
      `SELECT s.facility_id, a.current_status FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id WHERE a.id = ? FOR UPDATE`,
      [input.assetId]
    );
    if (!asset) throw new Error("ไม่พบทรัพย์สิน");
    if (isTerminalAssetStatus(asset.current_status)) throw new Error("ทรัพย์สินที่จำหน่ายหรือสูญหายแล้วให้ยืมไม่ได้");
    if (asset.current_status === "Broken") throw new Error("ทรัพย์สินอยู่ในสถานะชำรุด ให้ยืมไม่ได้");
    // The asset row lock above serialises concurrent loans, so this check cannot race.
    const [open] = await selectRows<RowDataPacket & { id: number; borrower_name: string }>(
      "SELECT id, borrower_name FROM asset_loans WHERE asset_id = ? AND status = 'OnLoan' LIMIT 1",
      [input.assetId]
    );
    if (open) throw new Error(`ทรัพย์สินนี้ถูกยืมอยู่แล้ว (#${open.id} โดย ${open.borrower_name})`);
    const { insertId } = await executeStatement(
      `INSERT INTO asset_loans (asset_id, facility_id, borrower_name, borrower_unit, borrower_contact, purpose, loaned_on, due_on, created_by_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.assetId, asset.facility_id, loan.borrowerName, loan.borrowerUnit || null, loan.borrowerContact || null, loan.purpose, loan.loanedOn, loan.dueOn, input.userId, input.userName]
    );
    const note = `[ให้ยืม] #${insertId} ${loan.borrowerName}${loan.borrowerUnit ? ` (${loan.borrowerUnit})` : ""} กำหนดคืน ${loan.dueOn} — ${loan.purpose}`;
    await insertAssetStatusHistory({ assetId: input.assetId, fromStatus: asset.current_status, toStatus: asset.current_status ?? "Active", note, changedByUserId: input.userId, changedBy: input.userName });
    return { loanId: insertId, facilityId: Number(asset.facility_id), note };
  });
}

export type ReturnLoanInput = { loanId: number; returnedOn: string; condition: string; note?: string; userId: number; userName: string };

/** Records the return. A damaged return marks the asset Broken so it shows up for repair. */
export async function returnLoan(input: ReturnLoanInput) {
  await ensureAssetStatusHistoryTable();
  return withTransaction(async () => {
    const [loan] = await selectRows<RowDataPacket & { id: number; asset_id: number; facility_id: number; status: LoanStatus; loaned_on: Date | string; borrower_name: string }>(
      "SELECT id, asset_id, facility_id, status, loaned_on, borrower_name FROM asset_loans WHERE id = ? FOR UPDATE",
      [input.loanId]
    );
    if (!loan) throw new Error("ไม่พบรายการยืม");
    if (loan.status !== "OnLoan") throw new Error("รายการนี้คืนหรือยกเลิกแล้ว");
    const condition = validateReturn({ returnedOn: input.returnedOn, condition: input.condition, loanedOn: day(loan.loaned_on) });
    const [asset] = await selectRows<RowDataPacket & { current_status: string | null }>("SELECT current_status FROM information_assets WHERE id = ? FOR UPDATE", [loan.asset_id]);
    await executeStatement(
      `UPDATE asset_loans SET status = 'Returned', returned_on = ?, return_condition = ?, return_note = ?, returned_by_user_id = ?, returned_by = ?, returned_recorded_at = NOW()
       WHERE id = ?`,
      [input.returnedOn, condition, input.note?.trim() || null, input.userId, input.userName, input.loanId]
    );
    const note = `[รับคืน] #${loan.id} จาก ${loan.borrower_name} วันที่ ${input.returnedOn} สภาพ${RETURN_CONDITION_LABELS[condition]}${input.note?.trim() ? ` — ${input.note.trim()}` : ""}`;
    const toStatus = condition === "Damaged" && !isTerminalAssetStatus(asset?.current_status) ? "Broken" : asset?.current_status ?? "Active";
    if (toStatus !== asset?.current_status) {
      await updateAsset(loan.asset_id, { currentStatus: toStatus, updatedBy: input.userName, lastUpdatedAt: new Date().toISOString().slice(0, 10) });
    }
    await insertAssetStatusHistory({ assetId: loan.asset_id, fromStatus: asset?.current_status ?? null, toStatus, note, changedByUserId: input.userId, changedBy: input.userName });
    return { assetId: loan.asset_id, facilityId: Number(loan.facility_id), note, markedBroken: toStatus === "Broken" && asset?.current_status !== "Broken" };
  });
}

export async function cancelLoan(input: { loanId: number; userId: number; userName: string }) {
  await ensureAssetStatusHistoryTable();
  return withTransaction(async () => {
    const [loan] = await selectRows<RowDataPacket & { id: number; asset_id: number; facility_id: number; status: LoanStatus }>(
      "SELECT id, asset_id, facility_id, status FROM asset_loans WHERE id = ? FOR UPDATE",
      [input.loanId]
    );
    if (!loan) throw new Error("ไม่พบรายการยืม");
    if (loan.status !== "OnLoan") throw new Error("รายการนี้คืนหรือยกเลิกแล้ว");
    await executeStatement("UPDATE asset_loans SET status = 'Cancelled', returned_by_user_id = ?, returned_by = ?, returned_recorded_at = NOW() WHERE id = ?", [input.userId, input.userName, input.loanId]);
    const [asset] = await selectRows<RowDataPacket & { current_status: string | null }>("SELECT current_status FROM information_assets WHERE id = ?", [loan.asset_id]);
    await insertAssetStatusHistory({ assetId: loan.asset_id, fromStatus: asset?.current_status ?? null, toStatus: asset?.current_status ?? "Active", note: `[ยกเลิกการยืม] #${loan.id} (บันทึกผิด)`, changedByUserId: input.userId, changedBy: input.userName });
    return { assetId: loan.asset_id, facilityId: Number(loan.facility_id) };
  });
}

export async function getLoan(id: number) {
  const rows = await selectRows<LoanRow>(`${LOAN_SELECT} WHERE l.id = ?`, [id]);
  return rows[0] ? toLoan(rows[0]) : null;
}

export async function listLoans(filter: { facilityIds?: number[]; status?: LoanStatus; assetId?: number; limit?: number }): Promise<LifecycleList<AssetLoan>> {
  if (filter.facilityIds && filter.facilityIds.length === 0) return { rows: [], schemaReady: true };
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter.facilityIds) { conditions.push(`l.facility_id IN (${filter.facilityIds.map(() => "?").join(",")})`); values.push(...filter.facilityIds); }
  if (filter.status) { conditions.push("l.status = ?"); values.push(filter.status); }
  if (filter.assetId) { conditions.push("l.asset_id = ?"); values.push(filter.assetId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Math.floor(filter.limit ?? 200), 1), 1000);
  try {
    const rows = await selectRows<LoanRow>(`${LOAN_SELECT} ${where} ORDER BY (l.status = 'OnLoan') DESC, l.due_on, l.id DESC LIMIT ${limit}`, values);
    return { rows: rows.map(toLoan), schemaReady: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], schemaReady: false };
    throw error;
  }
}
