import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { isTerminalAssetStatus } from "@/lib/asset-status";
import { ensureAssetStatusHistoryTable, insertAssetStatusHistory } from "@/lib/asset-status-history";
import { updateAsset } from "@/lib/assets";
import {
  DISPOSAL_REQUEST_TYPE_LABELS,
  disposalMethodLabel,
  isDisposalMethod,
  type DisposalRequestStatus,
  type DisposalRequestType,
} from "@/lib/disposal-options";
import { executeStatement, selectRows, withTransaction } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";
import type { LifecycleList } from "@/lib/asset-transfers";
import { formatAssetNumber } from "@/lib/asset-number";
import { fiscalYearRange } from "@/lib/asset-valuation";
import type { DisposalReportRow } from "@/lib/disposal-report";

export type DisposalRequest = {
  id: number;
  assetId: number;
  assetName: string;
  assetRegistrationNo: string;
  assetStatus: string;
  facilityId: number;
  facilityName: string;
  requestType: DisposalRequestType;
  disposalMethod: string | null;
  reason: string;
  eventDate: string;
  purchasePrice: number | null;
  bookValue: number | null;
  status: DisposalRequestStatus;
  requestedByUserId: number | null;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string;
  decidedAt: string;
  decisionNote: string;
  approvalDocumentNo: string;
  proceedsAmount: number | null;
  /** ผลการสอบหาข้อเท็จจริง (Lost requests). */
  factFindingNote: string;
  /** Recorded after approval, when the item has actually been sold/transferred/destroyed. */
  executedOn: string;
  executionDocumentNo: string;
  executionNote: string;
  executedBy: string;
};

type RequestRow = RowDataPacket & {
  id: number; asset_id: number; asset_name: string | null; asset_registration_no: string | null; current_status: string | null;
  facility_id: number; facility_name: string | null; request_type: DisposalRequestType; disposal_method: string | null;
  reason: string; event_date: Date | string; purchase_price: string | number | null; book_value: string | number | null;
  status: DisposalRequestStatus; requested_by_user_id: number | null; requested_by: string | null; requested_at: Date | string;
  decided_by: string | null; decided_at: Date | string | null; decision_note: string | null; approval_document_no: string | null;
  proceeds_amount: string | number | null;
  fact_finding_note?: string | null;
  executed_on?: Date | string | null;
  execution_document_no?: string | null;
  execution_note?: string | null;
  executed_by?: string | null;
};

const dateOnly = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10) : "");
const dateTime = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 19).replace("T", " ") : "");
const money = (value: string | number | null) => (value === null || value === undefined ? null : Number(value));

function toRequest(row: RequestRow): DisposalRequest {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name ?? "",
    assetRegistrationNo: row.asset_registration_no ?? "",
    assetStatus: row.current_status ?? "",
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "-",
    requestType: row.request_type,
    disposalMethod: row.disposal_method,
    reason: row.reason,
    eventDate: dateOnly(row.event_date),
    purchasePrice: money(row.purchase_price),
    bookValue: money(row.book_value),
    status: row.status,
    requestedByUserId: row.requested_by_user_id,
    requestedBy: row.requested_by ?? "",
    requestedAt: dateTime(row.requested_at),
    decidedBy: row.decided_by ?? "",
    decidedAt: dateTime(row.decided_at),
    decisionNote: row.decision_note ?? "",
    approvalDocumentNo: row.approval_document_no ?? "",
    proceedsAmount: money(row.proceeds_amount),
    factFindingNote: row.fact_finding_note ?? "",
    executedOn: dateOnly(row.executed_on ?? null),
    executionDocumentNo: row.execution_document_no ?? "",
    executionNote: row.execution_note ?? "",
    executedBy: row.executed_by ?? "",
  };
}

const REQUEST_SELECT = `
  SELECT r.*, a.asset_name, a.asset_registration_no, a.current_status, hf.name AS facility_name
  FROM asset_disposal_requests r
  JOIN information_assets a ON a.id = r.asset_id
  LEFT JOIN health_facilities hf ON hf.id = r.facility_id`;

export type CreateDisposalInput = {
  assetId: number;
  requestType: DisposalRequestType;
  disposalMethod?: string | null;
  reason: string;
  eventDate: string;
  bookValue?: number | null;
  /** ผลการสอบหาข้อเท็จจริง — only kept for Lost requests. */
  factFindingNote?: string | null;
  userId?: number | null;
  userName: string;
};

export async function createDisposalRequest(input: CreateDisposalInput) {
  if (!["Disposed", "Lost"].includes(input.requestType)) throw new Error("ประเภทคำขอไม่ถูกต้อง");
  if (!input.reason.trim()) throw new Error("กรุณาระบุเหตุผล");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) || input.eventDate > new Date().toISOString().slice(0, 10)) throw new Error("วันที่ไม่ถูกต้องหรือเกินวันที่ปัจจุบัน");
  let method = input.disposalMethod || null;
  if (input.requestType === "Disposed") {
    if (!method || !isDisposalMethod(method)) throw new Error("กรุณาเลือกวิธีการจำหน่าย");
  } else {
    method = null; // Loss approval records the write-off decision itself.
  }
  await ensureAssetStatusHistoryTable();

  return withTransaction(async () => {
    const [asset] = await selectRows<RowDataPacket & { id: number; facility_id: number; current_status: string | null; purchase_price: string | number | null }>(
      `SELECT a.id, s.facility_id, a.current_status, a.purchase_price
       FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE a.id = ? FOR UPDATE`,
      [input.assetId]
    );
    if (!asset) throw new Error("ไม่พบทรัพย์สิน");
    if (isTerminalAssetStatus(asset.current_status)) throw new Error("ทรัพย์สินนี้จำหน่ายหรือบันทึกสูญหายแล้ว");

    // The asset row lock above serialises concurrent requests, so this check cannot race.
    const [pending] = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM asset_disposal_requests WHERE asset_id = ? AND status = 'Pending' LIMIT 1",
      [input.assetId]
    );
    if (pending) throw new Error(`ทรัพย์สินนี้มีคำขอจำหน่าย/สูญหายที่รออนุมัติอยู่แล้ว (#${pending.id})`);

    const { insertId } = await executeStatement(
        `INSERT INTO asset_disposal_requests
          (asset_id, facility_id, request_type, disposal_method, reason, event_date, purchase_price, book_value, requested_by_user_id, requested_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.assetId, asset.facility_id, input.requestType, method, input.reason.trim(), input.eventDate, money(asset.purchase_price), input.bookValue ?? null, input.userId ?? null, input.userName]
      );

    const factFinding = input.requestType === "Lost" ? input.factFindingNote?.trim() : "";
    if (factFinding) {
      try {
        await executeStatement("UPDATE asset_disposal_requests SET fact_finding_note = ? WHERE id = ?", [factFinding, insertId]);
      } catch (error) {
        // Before add_registry_completeness.sql the finding is kept with the reason instead of being lost.
        if (!isMissingSchemaError(error)) throw error;
        await executeStatement("UPDATE asset_disposal_requests SET reason = CONCAT(reason, ?) WHERE id = ?", [`\nผลการสอบหาข้อเท็จจริง: ${factFinding}`, insertId]);
      }
    }

    const note = `[เสนอ${DISPOSAL_REQUEST_TYPE_LABELS[input.requestType]}] คำขอ #${insertId}${method ? ` วิธี: ${disposalMethodLabel(method)}` : ""} — ${input.reason.trim()}`;
    await insertAssetStatusHistory({ assetId: input.assetId, fromStatus: asset.current_status, toStatus: asset.current_status ?? "Active", note, changedByUserId: input.userId ?? null, changedBy: input.userName });
    return { requestId: insertId, facilityId: Number(asset.facility_id), note };
  });
}

export type DecideDisposalInput = {
  requestId: number;
  decision: "Approved" | "Rejected";
  note?: string;
  approvalDocumentNo?: string;
  proceedsAmount?: number | null;
  userId: number;
  userName: string;
};

async function lockPendingRequest(requestId: number) {
  const [request] = await selectRows<RowDataPacket & { id: number; asset_id: number; facility_id: number; request_type: DisposalRequestType; disposal_method: string | null; status: DisposalRequestStatus; requested_by_user_id: number | null }>(
    "SELECT id, asset_id, facility_id, request_type, disposal_method, status, requested_by_user_id FROM asset_disposal_requests WHERE id = ? FOR UPDATE",
    [requestId]
  );
  if (!request) throw new Error("ไม่พบคำขอ");
  if (request.status !== "Pending") throw new Error("คำขอนี้ได้รับการพิจารณาแล้ว");
  return request;
}

/** Approval is the only path that sets Disposed/Lost. The requester cannot approve their own request. */
export async function decideDisposalRequest(input: DecideDisposalInput) {
  if (!["Approved", "Rejected"].includes(input.decision)) throw new Error("ผลการพิจารณาไม่ถูกต้อง");
  if (input.decision === "Rejected" && !input.note?.trim()) throw new Error("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
  if (input.proceedsAmount != null && (!Number.isFinite(input.proceedsAmount) || input.proceedsAmount < 0)) throw new Error("จำนวนเงินที่ได้รับต้องไม่ติดลบ");
  await ensureAssetStatusHistoryTable();

  return withTransaction(async () => {
    const request = await lockPendingRequest(input.requestId);
    if (request.requested_by_user_id !== null && Number(request.requested_by_user_id) === Number(input.userId)) {
      throw new Error("ผู้เสนอไม่สามารถพิจารณาคำขอของตนเองได้");
    }
    const [asset] = await selectRows<RowDataPacket & { current_status: string | null }>(
      "SELECT current_status FROM information_assets WHERE id = ? FOR UPDATE",
      [request.asset_id]
    );
    if (!asset) throw new Error("ไม่พบทรัพย์สิน");

    await executeStatement(
      `UPDATE asset_disposal_requests
       SET status = ?, decided_by_user_id = ?, decided_by = ?, decided_at = NOW(), decision_note = ?, approval_document_no = ?, proceeds_amount = ?
       WHERE id = ?`,
      [input.decision, input.userId, input.userName, input.note?.trim() || null, input.approvalDocumentNo?.trim() || null, input.decision === "Approved" ? input.proceedsAmount ?? null : null, input.requestId]
    );

    const typeLabel = DISPOSAL_REQUEST_TYPE_LABELS[request.request_type];
    if (input.decision === "Approved") {
      await updateAsset(request.asset_id, { currentStatus: request.request_type, updatedBy: input.userName, lastUpdatedAt: new Date().toISOString().slice(0, 10) });
      // A disposed/lost asset cannot stay in an open repair queue.
      await executeStatement(
        `INSERT INTO asset_repair_logs (repair_id, from_status, to_status, note, changed_by_user_id, changed_by)
         SELECT id, status, 'Cancelled', ?, ?, ? FROM asset_repairs WHERE asset_id = ? AND status IN ('Reported','InProgress','SentToVendor')`,
        [`ยกเลิกอัตโนมัติ: อนุมัติ${typeLabel} คำขอ #${request.id}`, input.userId, input.userName, request.asset_id]
      );
      await executeStatement("UPDATE asset_repairs SET status = 'Cancelled', updated_by = ? WHERE asset_id = ? AND status IN ('Reported','InProgress','SentToVendor')", [input.userName, request.asset_id]);
    }
    const note = `[${input.decision === "Approved" ? "อนุมัติ" : "ไม่อนุมัติ"}${typeLabel}] คำขอ #${request.id}${input.approvalDocumentNo ? ` หนังสือ ${input.approvalDocumentNo}` : ""}${input.note ? ` — ${input.note.trim()}` : ""}`;
    await insertAssetStatusHistory({
      assetId: request.asset_id,
      fromStatus: asset.current_status,
      toStatus: input.decision === "Approved" ? request.request_type : asset.current_status ?? "Active",
      note,
      changedByUserId: input.userId,
      changedBy: input.userName,
    });
    return { assetId: request.asset_id, facilityId: Number(request.facility_id), note };
  });
}

export type RecordExecutionInput = {
  requestId: number;
  executedOn: string;
  documentNo?: string;
  proceedsAmount?: number | null;
  note?: string;
  userId: number;
  userName: string;
};

/**
 * Records that an approved disposal was carried out (sale, exchange, transfer or destruction):
 * date, receipt/evidence number and money received. Can be corrected later; the history keeps each change.
 */
export async function recordDisposalExecution(input: RecordExecutionInput) {
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.executedOn) || input.executedOn > today) throw new Error("วันที่ดำเนินการไม่ถูกต้องหรือเกินวันที่ปัจจุบัน");
  if (input.proceedsAmount != null && (!Number.isFinite(input.proceedsAmount) || input.proceedsAmount < 0)) throw new Error("จำนวนเงินที่ได้รับต้องไม่ติดลบ");
  await ensureAssetStatusHistoryTable();
  return withTransaction(async () => {
    const [request] = await selectRows<RowDataPacket & { id: number; asset_id: number; facility_id: number; request_type: DisposalRequestType; disposal_method: string | null; status: DisposalRequestStatus; decided_at: Date | string | null }>(
      "SELECT id, asset_id, facility_id, request_type, disposal_method, status, decided_at FROM asset_disposal_requests WHERE id = ? FOR UPDATE",
      [input.requestId]
    );
    if (!request) throw new Error("ไม่พบคำขอ");
    if (request.status !== "Approved" || request.request_type !== "Disposed") throw new Error("บันทึกผลการจำหน่ายได้เฉพาะคำขอจำหน่ายที่อนุมัติแล้ว");
    if (request.decided_at && input.executedOn < dateOnly(request.decided_at)) throw new Error("วันที่ดำเนินการต้องไม่ก่อนวันที่อนุมัติ");
    await executeStatement(
      `UPDATE asset_disposal_requests
       SET executed_on = ?, execution_document_no = ?, execution_note = ?, proceeds_amount = ?,
           executed_by_user_id = ?, executed_by = ?, executed_recorded_at = NOW()
       WHERE id = ?`,
      [input.executedOn, input.documentNo?.trim() || null, input.note?.trim() || null, input.proceedsAmount ?? null, input.userId, input.userName, input.requestId]
    );
    const [asset] = await selectRows<RowDataPacket & { current_status: string | null }>("SELECT current_status FROM information_assets WHERE id = ?", [request.asset_id]);
    const note = `[ดำเนินการจำหน่ายแล้ว] คำขอ #${request.id} ${disposalMethodLabel(request.disposal_method)} วันที่ ${input.executedOn}${input.documentNo ? ` หลักฐาน ${input.documentNo.trim()}` : ""}${input.proceedsAmount != null ? ` เงินที่ได้รับ ${input.proceedsAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท` : ""}`;
    await insertAssetStatusHistory({ assetId: request.asset_id, fromStatus: asset?.current_status ?? null, toStatus: asset?.current_status ?? "Disposed", note, changedByUserId: input.userId, changedBy: input.userName });
    return { assetId: request.asset_id, facilityId: Number(request.facility_id), note };
  });
}

/** Approved disposals whose actual sale/transfer/destruction has not been recorded yet. */
export async function listAwaitingExecution(facilityIds?: number[], limit = 200): Promise<DisposalRequest[]> {
  if (facilityIds && facilityIds.length === 0) return [];
  const scope = facilityIds ? ` AND r.facility_id IN (${facilityIds.map(() => "?").join(",")})` : "";
  try {
    const rows = await selectRows<RequestRow>(
      `${REQUEST_SELECT} WHERE r.status = 'Approved' AND r.request_type = 'Disposed' AND r.executed_on IS NULL${scope}
       ORDER BY r.decided_at, r.id LIMIT ${Math.min(Math.max(Math.floor(limit), 1), 1000)}`,
      facilityIds ?? []
    );
    return rows.map(toRequest);
  } catch (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
}

export async function cancelDisposalRequest(input: { requestId: number; userId: number; userName: string; canCancelOthers: boolean }) {
  await ensureAssetStatusHistoryTable();
  return withTransaction(async () => {
    const request = await lockPendingRequest(input.requestId);
    if (!input.canCancelOthers && Number(request.requested_by_user_id) !== Number(input.userId)) throw new Error("ยกเลิกได้เฉพาะคำขอที่คุณเสนอ");
    await executeStatement("UPDATE asset_disposal_requests SET status = 'Cancelled', decided_by_user_id = ?, decided_by = ?, decided_at = NOW(), decision_note = 'ยกเลิกโดยผู้ใช้' WHERE id = ?", [input.userId, input.userName, input.requestId]);
    const [asset] = await selectRows<RowDataPacket & { current_status: string | null }>("SELECT current_status FROM information_assets WHERE id = ?", [request.asset_id]);
    await insertAssetStatusHistory({ assetId: request.asset_id, fromStatus: asset?.current_status ?? null, toStatus: asset?.current_status ?? "Active", note: `[ยกเลิกคำขอ${DISPOSAL_REQUEST_TYPE_LABELS[request.request_type]}] คำขอ #${request.id}`, changedByUserId: input.userId, changedBy: input.userName });
    return { assetId: request.asset_id, facilityId: Number(request.facility_id) };
  });
}

export async function getDisposalRequest(id: number) {
  const rows = await selectRows<RequestRow>(`${REQUEST_SELECT} WHERE r.id = ?`, [id]);
  return rows[0] ? toRequest(rows[0]) : null;
}

export async function listDisposalRequests(filter: { facilityIds?: number[]; status?: DisposalRequestStatus; assetId?: number; dateFrom?: string; dateTo?: string; limit?: number }): Promise<LifecycleList<DisposalRequest>> {
  if (filter.facilityIds && filter.facilityIds.length === 0) return { rows: [], schemaReady: true };
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter.facilityIds) { conditions.push(`r.facility_id IN (${filter.facilityIds.map(() => "?").join(",")})`); values.push(...filter.facilityIds); }
  if (filter.status) { conditions.push("r.status = ?"); values.push(filter.status); }
  if (filter.assetId) { conditions.push("r.asset_id = ?"); values.push(filter.assetId); }
  if (filter.dateFrom) { conditions.push("r.requested_at >= ?"); values.push(`${filter.dateFrom} 00:00:00`); }
  if (filter.dateTo) { conditions.push("r.requested_at <= ?"); values.push(`${filter.dateTo} 23:59:59`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Math.floor(filter.limit ?? 100), 1), 1000);
  try {
    const rows = await selectRows<RequestRow>(`${REQUEST_SELECT} ${where} ORDER BY (r.status = 'Pending') DESC, r.requested_at DESC, r.id DESC LIMIT ${limit}`, values);
    return { rows: rows.map(toRequest), schemaReady: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], schemaReady: false };
    throw error;
  }
}

/** Rows for the disposal documents: pending requests, or approvals decided within a fiscal year. */
export async function listDisposalReportRows(filter: { kind: "pending" | "annual"; facilityIds?: number[]; fiscalYear?: number }): Promise<{ rows: DisposalReportRow[]; schemaReady: boolean }> {
  if (filter.facilityIds && filter.facilityIds.length === 0) return { rows: [], schemaReady: true };
  const conditions = [filter.kind === "pending" ? "r.status = 'Pending'" : "r.status = 'Approved'"];
  const values: unknown[] = [];
  if (filter.kind === "annual" && filter.fiscalYear) {
    const range = fiscalYearRange(filter.fiscalYear);
    conditions.push("r.decided_at BETWEEN ? AND ?");
    values.push(`${range.start} 00:00:00`, `${range.end} 23:59:59`);
  }
  if (filter.facilityIds) {
    conditions.push(`r.facility_id IN (${filter.facilityIds.map(() => "?").join(",")})`);
    values.push(...filter.facilityIds);
  }
  type Row = RequestRow & { asset_purchase_date: Date | string | null; asset_installed_at: Date | string | null };
  let rows: Row[];
  try {
    rows = await selectRows<Row>(
      `SELECT r.*, a.asset_name, a.asset_registration_no, a.current_status, a.purchase_date AS asset_purchase_date, a.installed_at AS asset_installed_at, hf.name AS facility_name
       FROM asset_disposal_requests r
       JOIN information_assets a ON a.id = r.asset_id
       LEFT JOIN health_facilities hf ON hf.id = r.facility_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY hf.name, r.${filter.kind === "pending" ? "requested_at" : "decided_at"}, r.id
       LIMIT 5000`,
      values
    );
  } catch (error) {
    if (isMissingSchemaError(error)) return { rows: [], schemaReady: false };
    throw error;
  }
  const prefixes = new Map<number, string | null>();
  if (rows.length) {
    try {
      const ids = [...new Set(rows.map((row) => row.asset_id))];
      const found = await selectRows<RowDataPacket & { id: number; asset_code_prefix: string | null }>(
        `SELECT id, asset_code_prefix FROM information_assets WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      for (const row of found) prefixes.set(row.id, row.asset_code_prefix);
    } catch (error) {
      if (!isMissingSchemaError(error)) throw error;
    }
  }
  return {
    schemaReady: true,
    rows: rows.map((row) => {
      const request = toRequest(row);
      return {
        id: request.id,
        assetNumber: formatAssetNumber(prefixes.get(row.asset_id), row.asset_registration_no) || "-",
        assetName: request.assetName,
        acquiredOn: dateOnly(row.asset_purchase_date) || dateOnly(row.asset_installed_at),
        requestType: request.requestType,
        disposalMethod: request.disposalMethod,
        reason: [request.reason, request.factFindingNote && `ผลการสอบหาข้อเท็จจริง: ${request.factFindingNote}`].filter(Boolean).join("\n"),
        purchasePrice: request.purchasePrice,
        bookValue: request.bookValue,
        requestedBy: request.requestedBy,
        requestedAt: request.requestedAt,
        decidedAt: request.decidedAt,
        approvalDocumentNo: request.approvalDocumentNo,
        executedOn: request.executedOn,
        executionDocumentNo: request.executionDocumentNo,
        proceedsAmount: request.proceedsAmount,
      };
    }),
  };
}
