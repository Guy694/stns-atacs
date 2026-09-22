import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { fiscalYearRange } from "@/lib/asset-valuation";
import { inspectionDeadline, summarizeInspectionProgress, type FacilityProgressRow } from "@/lib/inspection-progress";
import { formatAssetNumber } from "@/lib/asset-number";
import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

/** `null` = every facility (admins); an empty list means the user may see nothing. */
export type FacilityScope = number[] | null;

function scopeClause(column: string, facilityIds: FacilityScope) {
  if (!facilityIds) return { sql: "", values: [] as unknown[] };
  return { sql: ` AND ${column} IN (${facilityIds.map(() => "?").join(",")})`, values: facilityIds as unknown[] };
}

async function orDefault<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isMissingSchemaError(error)) return fallback;
    throw error;
  }
}

// Rounds count towards the fiscal year in which they started (or were created, when no start date was set).
const ROUND_DATE = "COALESCE(r.start_date, DATE(r.inspected_at))";

/** Per asset still on the register: was it put into a round this fiscal year, and what was found. */
function assetResultsSubquery() {
  return `
    SELECT i.asset_id,
      MAX(CASE WHEN COALESCE(i.inspection_status, 'Pending') <> 'Pending' THEN 1 ELSE 0 END) AS checked,
      MAX(CASE WHEN i.inspection_status = 'Found' THEN 1 ELSE 0 END) AS found,
      MAX(CASE WHEN i.inspection_status = 'Missing' THEN 1 ELSE 0 END) AS missing
    FROM asset_inspection_items i
    JOIN asset_inspections r ON r.id = i.inspection_id
    WHERE ${ROUND_DATE} BETWEEN ? AND ?
    GROUP BY i.asset_id`;
}

export async function getInspectionProgress(fiscalYear: number, facilities: Array<{ id: number; name: string; district: string }>, facilityIds: FacilityScope) {
  const range = fiscalYearRange(fiscalYear);
  if (facilityIds && !facilityIds.length) return { fiscalYear, range, ...summarizeInspectionProgress([]), schemaReady: true };
  const scope = scopeClause("s.facility_id", facilityIds);
  type AssetRow = RowDataPacket & { facility_id: number; assets: number; covered: number; checked: number; found: number; missing: number };
  type RoundRow = RowDataPacket & { facility_id: number; open_rounds: number; closed_rounds: number };
  try {
    const assetRows = await selectRows<AssetRow>(
      `SELECT s.facility_id, COUNT(a.id) AS assets,
         SUM(CASE WHEN x.asset_id IS NULL THEN 0 ELSE 1 END) AS covered,
         SUM(COALESCE(x.checked, 0)) AS checked, SUM(COALESCE(x.found, 0)) AS found, SUM(COALESCE(x.missing, 0)) AS missing
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
       LEFT JOIN (${assetResultsSubquery()}) x ON x.asset_id = a.id
       WHERE COALESCE(a.current_status, '') NOT IN ('Disposed', 'Lost')${scope.sql}
       GROUP BY s.facility_id`,
      [range.start, range.end, ...scope.values]
    );
    const roundScope = scopeClause("r.facility_id", facilityIds);
    const roundQuery = (withStatus: boolean) => selectRows<RoundRow>(
      `SELECT r.facility_id,
         ${withStatus ? "SUM(CASE WHEN r.round_status = 'Closed' THEN 0 ELSE 1 END)" : "COUNT(*)"} AS open_rounds,
         ${withStatus ? "SUM(CASE WHEN r.round_status = 'Closed' THEN 1 ELSE 0 END)" : "0"} AS closed_rounds
       FROM asset_inspections r
       WHERE ${ROUND_DATE} BETWEEN ? AND ?${roundScope.sql}
       GROUP BY r.facility_id`,
      [range.start, range.end, ...roundScope.values]
    );
    let roundRows: RoundRow[];
    try {
      roundRows = await roundQuery(true);
    } catch (error) {
      if (!isMissingSchemaError(error)) throw error;
      roundRows = await roundQuery(false);
    }
    const byAssets = new Map(assetRows.map((row) => [Number(row.facility_id), row]));
    const byRounds = new Map(roundRows.map((row) => [Number(row.facility_id), row]));
    const rows: FacilityProgressRow[] = facilities
      .map((facility) => {
        const assets = byAssets.get(facility.id);
        const rounds = byRounds.get(facility.id);
        return {
          facilityId: facility.id,
          facilityName: facility.name,
          districtName: facility.district,
          assets: Number(assets?.assets ?? 0),
          covered: Number(assets?.covered ?? 0),
          checked: Number(assets?.checked ?? 0),
          found: Number(assets?.found ?? 0),
          missing: Number(assets?.missing ?? 0),
          openRounds: Number(rounds?.open_rounds ?? 0),
          closedRounds: Number(rounds?.closed_rounds ?? 0),
        };
      })
      .filter((row) => row.assets > 0 || row.openRounds > 0 || row.closedRounds > 0);
    return { fiscalYear, range, ...summarizeInspectionProgress(rows), schemaReady: true };
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    return { fiscalYear, range, ...summarizeInspectionProgress([]), schemaReady: false };
  }
}

export type UncoveredAsset = {
  id: number;
  assetNumber: string;
  assetName: string;
  facilityId: number;
  facilityName: string;
  workGroupName: string;
  locationDetail: string;
  currentStatus: string;
};

/** Assets still on the register that no round of the fiscal year includes. */
export async function listUncoveredAssets(fiscalYear: number, facilityIds: FacilityScope, limit = 500): Promise<{ rows: UncoveredAsset[]; total: number }> {
  if (facilityIds && !facilityIds.length) return { rows: [], total: 0 };
  const range = fiscalYearRange(fiscalYear);
  const scope = scopeClause("s.facility_id", facilityIds);
  const from = `
    FROM information_assets a
    JOIN information_asset_surveys s ON s.id = a.survey_id
    LEFT JOIN health_facilities hf ON hf.id = s.facility_id
    LEFT JOIN facility_work_groups fwg ON fwg.id = a.work_group_id
    WHERE COALESCE(a.current_status, '') NOT IN ('Disposed', 'Lost')${scope.sql}
      AND NOT EXISTS (
        SELECT 1 FROM asset_inspection_items i JOIN asset_inspections r ON r.id = i.inspection_id
        WHERE i.asset_id = a.id AND ${ROUND_DATE} BETWEEN ? AND ?)`;
  const values = [...scope.values, range.start, range.end];
  type Row = RowDataPacket & { id: number; asset_code_prefix?: string | null; asset_registration_no: string | null; asset_name: string; facility_id: number; facility_name: string | null; work_group_name: string | null; location_detail: string | null; current_status: string | null };
  const query = (withPrefix: boolean) => selectRows<Row>(
    `SELECT a.id,${withPrefix ? " a.asset_code_prefix," : ""} a.asset_registration_no, a.asset_name, s.facility_id, hf.name AS facility_name,
       fwg.work_group_name, a.location_detail, a.current_status
     ${from}
     ORDER BY hf.name, fwg.work_group_name, a.asset_registration_no
     LIMIT ${Math.min(Math.max(Math.floor(limit), 1), 2000)}`,
    values
  );
  return orDefault(async () => {
    let rows: Row[];
    try {
      rows = await query(true);
    } catch (error) {
      if (!isMissingSchemaError(error)) throw error;
      rows = await query(false);
    }
    const [count] = await selectRows<RowDataPacket & { total: number }>(`SELECT COUNT(*) AS total ${from}`, values);
    return {
      total: Number(count?.total ?? rows.length),
      rows: rows.map((row) => ({
        id: row.id,
        assetNumber: formatAssetNumber(row.asset_code_prefix, row.asset_registration_no) || "-",
        assetName: row.asset_name,
        facilityId: row.facility_id,
        facilityName: row.facility_name ?? "-",
        workGroupName: row.work_group_name ?? "",
        locationDetail: row.location_detail ?? "",
        currentStatus: row.current_status ?? "",
      })),
    };
  }, { rows: [], total: 0 });
}

export type OpenRoundDeadline = {
  id: number;
  roundName: string;
  facilityName: string;
  startDate: string;
  remainingItems: number;
  dueDate: string;
  daysLeft: number;
  state: ReturnType<typeof inspectionDeadline>["state"];
};

export type WorkQueue = {
  pendingDisposals: number;
  awaitingExecution: number;
  openRepairs: number;
  urgentRepairs: number;
  overdueLoans: number;
  activeLoans: number;
  openRounds: OpenRoundDeadline[];
};

/** Counts for the "งานรอดำเนินการ" panel. Every source falls back to zero before its migration runs. */
export async function getWorkQueue(facilityIds: FacilityScope, today = new Date().toISOString().slice(0, 10)): Promise<WorkQueue> {
  const empty: WorkQueue = { pendingDisposals: 0, awaitingExecution: 0, openRepairs: 0, urgentRepairs: 0, overdueLoans: 0, activeLoans: 0, openRounds: [] };
  if (facilityIds && !facilityIds.length) return empty;
  const count = async (sql: string, column: string, extra: unknown[] = []) => {
    const scope = scopeClause(column, facilityIds);
    const [row] = await selectRows<RowDataPacket & { total: number }>(`${sql}${scope.sql}`, [...extra, ...scope.values]);
    return Number(row?.total ?? 0);
  };
  const [pendingDisposals, awaitingExecution, openRepairs, urgentRepairs, activeLoans, overdueLoans] = await Promise.all([
    orDefault(() => count("SELECT COUNT(*) AS total FROM asset_disposal_requests r WHERE r.status = 'Pending'", "r.facility_id"), 0),
    orDefault(() => count("SELECT COUNT(*) AS total FROM asset_disposal_requests r WHERE r.status = 'Approved' AND r.request_type = 'Disposed' AND r.executed_on IS NULL", "r.facility_id"), 0),
    orDefault(() => count("SELECT COUNT(*) AS total FROM asset_repairs r WHERE r.status IN ('Reported','InProgress','SentToVendor')", "r.facility_id"), 0),
    orDefault(() => count("SELECT COUNT(*) AS total FROM asset_repairs r WHERE r.status IN ('Reported','InProgress','SentToVendor') AND r.priority IN ('High','Urgent')", "r.facility_id"), 0),
    orDefault(() => count("SELECT COUNT(*) AS total FROM asset_loans l WHERE l.status = 'OnLoan'", "l.facility_id"), 0),
    orDefault(() => count("SELECT COUNT(*) AS total FROM asset_loans l WHERE l.status = 'OnLoan' AND l.due_on < ?", "l.facility_id", [today]), 0),
  ]);

  type RoundRow = RowDataPacket & { id: number; round_name: string; facility_name: string | null; start_date: Date | string | null; inspected_at: Date | string; total_items: number; checked_items: number };
  const scope = scopeClause("r.facility_id", facilityIds);
  const roundRows = await orDefault(() => selectRows<RoundRow>(
    `SELECT r.id, r.round_name, hf.name AS facility_name, r.start_date, r.inspected_at,
       COUNT(i.id) AS total_items,
       SUM(CASE WHEN COALESCE(i.inspection_status, 'Pending') <> 'Pending' THEN 1 ELSE 0 END) AS checked_items
     FROM asset_inspections r
     LEFT JOIN health_facilities hf ON hf.id = r.facility_id
     LEFT JOIN asset_inspection_items i ON i.inspection_id = r.id
     WHERE r.round_status = 'Open'${scope.sql}
     GROUP BY r.id, r.round_name, hf.name, r.start_date, r.inspected_at
     ORDER BY COALESCE(r.start_date, DATE(r.inspected_at))
     LIMIT 200`,
    scope.values
  ), [] as RoundRow[]);
  const day = (value: Date | string | null) => (value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10) : "");
  const openRounds = roundRows
    .map((row) => {
      const startDate = day(row.start_date) || day(row.inspected_at);
      const deadline = inspectionDeadline({ startDate, roundStatus: "Open" }, today);
      return {
        id: row.id,
        roundName: row.round_name,
        facilityName: row.facility_name ?? "-",
        startDate,
        remainingItems: Math.max(0, Number(row.total_items ?? 0) - Number(row.checked_items ?? 0)),
        ...deadline,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return { pendingDisposals, awaitingExecution, openRepairs, urgentRepairs, overdueLoans, activeLoans, openRounds };
}
