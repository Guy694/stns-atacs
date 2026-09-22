/**
 * Annual inspection progress and deadlines (pure functions; the queries live in lib/dashboard-work.ts).
 *
 * The committee reports its findings to the head of the unit within 30 working days of starting the
 * check. Working days here skip Saturdays and Sundays only; public holidays are not known to the system,
 * so the date shown is the earliest possible deadline.
 */
export const INSPECTION_REPORT_WORKING_DAYS = 30;
export const DEADLINE_WARNING_DAYS = 7;

const parse = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** The date `days` working days (Mon–Fri) after `start`. */
export function addWorkingDays(start: string, days: number) {
  const date = parse(start);
  if (!date) return "";
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return iso(date);
}

export function daysBetween(from: string, to: string) {
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type DeadlineState = "closed" | "overdue" | "due-soon" | "on-track" | "no-date";
export type InspectionDeadline = { dueDate: string; daysLeft: number; state: DeadlineState };

export const DEADLINE_LABELS: Record<DeadlineState, string> = {
  closed: "ปิดรอบแล้ว",
  overdue: "เกินกำหนดส่งรายงาน",
  "due-soon": "ใกล้ครบกำหนด",
  "on-track": "อยู่ในกำหนด",
  "no-date": "ไม่ได้ระบุวันเริ่มตรวจ",
};

export function inspectionDeadline(round: { startDate: string; roundStatus: "Open" | "Closed" }, today = new Date().toISOString().slice(0, 10)): InspectionDeadline {
  const dueDate = round.startDate ? addWorkingDays(round.startDate, INSPECTION_REPORT_WORKING_DAYS) : "";
  const daysLeft = dueDate ? daysBetween(today, dueDate) : 0;
  if (round.roundStatus === "Closed") return { dueDate, daysLeft, state: "closed" };
  if (!dueDate) return { dueDate, daysLeft, state: "no-date" };
  if (daysLeft < 0) return { dueDate, daysLeft, state: "overdue" };
  if (daysLeft <= DEADLINE_WARNING_DAYS) return { dueDate, daysLeft, state: "due-soon" };
  return { dueDate, daysLeft, state: "on-track" };
}

/** One row per facility from the progress query. `assets` counts only assets still on the register. */
export type FacilityProgressRow = {
  facilityId: number;
  facilityName: string;
  districtName: string;
  assets: number;
  covered: number;
  checked: number;
  found: number;
  missing: number;
  openRounds: number;
  closedRounds: number;
};

export type ProgressStage = "not-started" | "in-progress" | "checked" | "partial" | "closed";

export const PROGRESS_STAGE_LABELS: Record<ProgressStage, string> = {
  "not-started": "ยังไม่เปิดรอบ",
  "in-progress": "กำลังตรวจนับ",
  checked: "ตรวจครบ รอปิดรอบ",
  partial: "ปิดรอบแล้ว แต่ยังมีรายการตกหล่น",
  closed: "ปิดรอบครบแล้ว",
};

export function progressStage(row: FacilityProgressRow): ProgressStage {
  if (!row.openRounds && !row.closedRounds) return "not-started";
  if (row.openRounds) return row.assets > 0 && row.checked >= row.assets ? "checked" : "in-progress";
  return row.covered >= row.assets ? "closed" : "partial";
}

const ratio = (part: number, whole: number) => (whole > 0 ? Math.min(1, part / whole) : 0);

export function summarizeInspectionProgress(rows: FacilityProgressRow[]) {
  const facilities = rows
    .map((row) => ({
      ...row,
      uncovered: Math.max(0, row.assets - row.covered),
      coverageRate: ratio(row.covered, row.assets),
      checkedRate: ratio(row.checked, row.assets),
      stage: progressStage(row),
    }))
    .sort((a, b) => a.checkedRate - b.checkedRate || a.districtName.localeCompare(b.districtName, "th") || a.facilityName.localeCompare(b.facilityName, "th"));
  const totals = facilities.reduce(
    (sum, row) => ({
      assets: sum.assets + row.assets,
      covered: sum.covered + row.covered,
      checked: sum.checked + row.checked,
      found: sum.found + row.found,
      missing: sum.missing + row.missing,
      openRounds: sum.openRounds + row.openRounds,
      closedRounds: sum.closedRounds + row.closedRounds,
    }),
    { assets: 0, covered: 0, checked: 0, found: 0, missing: 0, openRounds: 0, closedRounds: 0 }
  );
  const stageCounts = { "not-started": 0, "in-progress": 0, checked: 0, partial: 0, closed: 0 } as Record<ProgressStage, number>;
  for (const row of facilities) stageCounts[row.stage] += 1;
  return {
    facilities,
    totals: { ...totals, uncovered: Math.max(0, totals.assets - totals.covered), coverageRate: ratio(totals.covered, totals.assets), checkedRate: ratio(totals.checked, totals.assets) },
    stageCounts,
  };
}

export type InspectionProgressSummary = ReturnType<typeof summarizeInspectionProgress>;
