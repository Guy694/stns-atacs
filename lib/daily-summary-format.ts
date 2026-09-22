/**
 * Daily Telegram summary (pure formatting; data comes from lib/daily-summary.ts).
 * One message per day listing work that needs attention across the facilities.
 */
export type SummarySection = { count: number; items: string[] };

export type DailySummaryData = {
  date: string;
  overdueLoans: SummarySection;
  inspectionDeadlines: SummarySection;
  expiringContracts: SummarySection;
  pendingDisposals: SummarySection;
  staleRepairs: SummarySection;
};

export type DailySummaryThresholds = {
  warrantyDays: number;
  disposalPendingDays: number;
  repairOpenDays: number;
  inspectionWarnDays: number;
};

export const DEFAULT_SUMMARY_THRESHOLDS: DailySummaryThresholds = {
  warrantyDays: 30,
  disposalPendingDays: 7,
  repairOpenDays: 14,
  inspectionWarnDays: 7,
};

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 365 ? parsed : fallback;
}

export function summaryThresholdsFromEnv(env: Record<string, string | undefined>): DailySummaryThresholds {
  return {
    warrantyDays: positiveInt(env.SUMMARY_WARRANTY_DAYS, DEFAULT_SUMMARY_THRESHOLDS.warrantyDays),
    disposalPendingDays: positiveInt(env.SUMMARY_DISPOSAL_PENDING_DAYS, DEFAULT_SUMMARY_THRESHOLDS.disposalPendingDays),
    repairOpenDays: positiveInt(env.SUMMARY_REPAIR_OPEN_DAYS, DEFAULT_SUMMARY_THRESHOLDS.repairOpenDays),
    inspectionWarnDays: positiveInt(env.SUMMARY_INSPECTION_WARN_DAYS, DEFAULT_SUMMARY_THRESHOLDS.inspectionWarnDays),
  };
}

export function hasSummaryContent(data: DailySummaryData) {
  return [data.overdueLoans, data.inspectionDeadlines, data.expiringContracts, data.pendingDisposals, data.staleRepairs].some((section) => section.count > 0);
}

/** "3 รายการ" + up to `maxItems` lines, then "… และอีก N รายการ"; kept under Telegram's per-field limit. */
export function formatSection(section: SummarySection, maxItems = 5, maxChars = 480) {
  if (!section.count) return "";
  const lines: string[] = [`${section.count.toLocaleString("th-TH")} รายการ`];
  let shown = 0;
  for (const item of section.items.slice(0, maxItems)) {
    const line = `- ${item.replace(/\s+/g, " ").trim()}`;
    if (lines.join("\n").length + line.length + 1 > maxChars) break;
    lines.push(line);
    shown += 1;
  }
  const rest = section.count - shown;
  if (rest > 0 && shown > 0) lines.push(`… และอีก ${rest.toLocaleString("th-TH")} รายการ`);
  return lines.join("\n");
}

export function buildDailySummaryDetails(data: DailySummaryData, thresholds: DailySummaryThresholds = DEFAULT_SUMMARY_THRESHOLDS) {
  return {
    "ยืมเกินกำหนดคืน": formatSection(data.overdueLoans),
    [`ตรวจนับใกล้ครบ/เกินกำหนดรายงาน (${thresholds.inspectionWarnDays} วัน)`]: formatSection(data.inspectionDeadlines),
    [`ประกัน/สัญญา MA หมดใน ${thresholds.warrantyDays} วัน`]: formatSection(data.expiringContracts),
    [`คำขอจำหน่ายรออนุมัติเกิน ${thresholds.disposalPendingDays} วัน`]: formatSection(data.pendingDisposals),
    [`งานซ่อมค้างเกิน ${thresholds.repairOpenDays} วัน`]: formatSection(data.staleRepairs),
  };
}

export function dailySummaryEventKey(date: string) {
  return `daily-summary:${date}`;
}
