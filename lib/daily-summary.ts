import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { formatAssetNumber } from "@/lib/asset-number";
import { inspectionDeadline } from "@/lib/inspection-progress";
import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";
import type { DailySummaryData, DailySummaryThresholds, SummarySection } from "@/lib/daily-summary-format";

const LIMIT = 20;
const EMPTY: SummarySection = { count: 0, items: [] };

async function section(work: () => Promise<SummarySection>): Promise<SummarySection> {
  try {
    return await work();
  } catch (error) {
    // A module whose tables are not migrated yet simply reports nothing.
    if (isMissingSchemaError(error)) return EMPTY;
    throw error;
  }
}

const day = (value: Date | string | null | undefined) => {
  if (!value) return "";
  if (value instanceof Date) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
};

type AssetCols = { asset_code_prefix?: string | null; asset_registration_no: string | null; asset_name: string | null; facility_name: string | null };
const label = (row: AssetCols) => `${formatAssetNumber(row.asset_code_prefix, row.asset_registration_no) || "-"} ${row.asset_name ?? ""} (${row.facility_name ?? "-"})`;

async function countAndRows<T extends RowDataPacket>(fromWhere: string, select: string, orderBy: string, values: unknown[]) {
  const [count] = await selectRows<RowDataPacket & { total: number }>(`SELECT COUNT(*) AS total ${fromWhere}`, values);
  const rows = await selectRows<T>(`SELECT ${select} ${fromWhere} ORDER BY ${orderBy} LIMIT ${LIMIT}`, values);
  return { total: Number(count?.total ?? 0), rows };
}

const ASSET_JOIN = `
  JOIN information_assets a ON a.id = x.asset_id
  LEFT JOIN information_asset_surveys s ON s.id = a.survey_id
  LEFT JOIN health_facilities hf ON hf.id = COALESCE(x.facility_id, s.facility_id)`;

export async function collectDailySummary(today: string, thresholds: DailySummaryThresholds): Promise<DailySummaryData> {
  const assetCols = "a.asset_code_prefix, a.asset_registration_no, a.asset_name, hf.name AS facility_name";

  const overdueLoans = section(async () => {
    type Row = RowDataPacket & AssetCols & { borrower_name: string; due_on: Date | string };
    const { total, rows } = await countAndRows<Row>(
      `FROM asset_loans x ${ASSET_JOIN} WHERE x.status = 'OnLoan' AND x.due_on < ?`,
      `${assetCols}, x.borrower_name, x.due_on`, "x.due_on", [today]);
    return { count: total, items: rows.map((row) => `${label(row)} · ${row.borrower_name} · ครบ ${day(row.due_on)}`) };
  });

  const inspectionDeadlines = section(async () => {
    type Row = RowDataPacket & { id: number; round_name: string; facility_name: string | null; start_date: Date | string | null; inspected_at: Date | string };
    const rows = await selectRows<Row>(
      `SELECT r.id, r.round_name, hf.name AS facility_name, r.start_date, r.inspected_at
         FROM asset_inspections r LEFT JOIN health_facilities hf ON hf.id = r.facility_id
        WHERE r.round_status = 'Open'
        ORDER BY COALESCE(r.start_date, DATE(r.inspected_at)) LIMIT 500`, []);
    const due = rows
      .map((row) => ({ row, deadline: inspectionDeadline({ startDate: day(row.start_date) || day(row.inspected_at), roundStatus: "Open" }, today) }))
      .filter(({ deadline }) => deadline.dueDate && deadline.daysLeft <= thresholds.inspectionWarnDays)
      .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
    return {
      count: due.length,
      items: due.slice(0, LIMIT).map(({ row, deadline }) =>
        `${row.round_name} (${row.facility_name ?? "-"}) · ${deadline.daysLeft < 0 ? `เกินกำหนด ${-deadline.daysLeft} วัน` : `เหลือ ${deadline.daysLeft} วัน`} (${deadline.dueDate})`),
    };
  });

  const expiringContracts = section(async () => {
    type Row = RowDataPacket & AssetCols & { warranty_end_date: Date | string | null; maintenance_end_date: Date | string | null };
    const until = new Date(`${today}T00:00:00Z`);
    until.setUTCDate(until.getUTCDate() + thresholds.warrantyDays);
    const end = until.toISOString().slice(0, 10);
    const { total, rows } = await countAndRows<Row>(
      `FROM information_assets a
        LEFT JOIN information_asset_surveys s ON s.id = a.survey_id
        LEFT JOIN health_facilities hf ON hf.id = s.facility_id
       WHERE COALESCE(a.current_status, '') NOT IN ('Disposed', 'Lost')
         AND ((a.warranty_end_date BETWEEN ? AND ?) OR (a.maintenance_end_date BETWEEN ? AND ?))`,
      `${assetCols}, a.warranty_end_date, a.maintenance_end_date`,
      "LEAST(COALESCE(a.warranty_end_date, '9999-12-31'), COALESCE(a.maintenance_end_date, '9999-12-31'))",
      [today, end, today, end]);
    return {
      count: total,
      items: rows.map((row) => {
        const parts = [];
        const warranty = day(row.warranty_end_date);
        const ma = day(row.maintenance_end_date);
        if (warranty && warranty >= today && warranty <= end) parts.push(`ประกัน ${warranty}`);
        if (ma && ma >= today && ma <= end) parts.push(`MA ${ma}`);
        return `${label(row)} · ${parts.join(", ")}`;
      }),
    };
  });

  const pendingDisposals = section(async () => {
    type Row = RowDataPacket & AssetCols & { id: number; requested_at: Date | string; request_type: string };
    const { total, rows } = await countAndRows<Row>(
      `FROM asset_disposal_requests x ${ASSET_JOIN} WHERE x.status = 'Pending' AND x.requested_at < DATE_SUB(?, INTERVAL ? DAY)`,
      `${assetCols}, x.id, x.requested_at, x.request_type`, "x.requested_at", [today, thresholds.disposalPendingDays]);
    return { count: total, items: rows.map((row) => `#${row.id} ${label(row)} · ${row.request_type === "Lost" ? "สูญหาย" : "จำหน่าย"} · เสนอ ${day(row.requested_at)}`) };
  });

  const staleRepairs = section(async () => {
    type Row = RowDataPacket & AssetCols & { id: number; reported_at: Date | string; status: string; priority: string };
    const { total, rows } = await countAndRows<Row>(
      `FROM asset_repairs x ${ASSET_JOIN} WHERE x.status IN ('Reported','InProgress','SentToVendor') AND x.reported_at < DATE_SUB(?, INTERVAL ? DAY)`,
      `${assetCols}, x.id, x.reported_at, x.status, x.priority`, "x.reported_at", [today, thresholds.repairOpenDays]);
    const status: Record<string, string> = { Reported: "รอรับงาน", InProgress: "กำลังซ่อม", SentToVendor: "ส่งร้าน" };
    return { count: total, items: rows.map((row) => `#${row.id} ${label(row)} · ${status[row.status] ?? row.status} · แจ้ง ${day(row.reported_at)}`) };
  });

  const [a, b, c, d, e] = await Promise.all([overdueLoans, inspectionDeadlines, expiringContracts, pendingDisposals, staleRepairs]);
  return { date: today, overdueLoans: a, inspectionDeadlines: b, expiringContracts: c, pendingDisposals: d, staleRepairs: e };
}
