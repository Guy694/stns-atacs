import { dashboardCategoryId, DEPRECIATION_CATEGORIES } from "@/lib/asset-depreciation";
import { normalizeAssetClass } from "@/lib/asset-classes";
import type { AssetClassification } from "@/lib/asset-policy";

/**
 * Straight-line depreciation estimate for the asset register (ทะเบียนคุมทรัพย์สิน).
 * - Useful life comes from the per-asset override, otherwise from the class/subtype schedule
 *   in lib/asset-depreciation.ts (docs/ตารางกำหนดอายุการใช้งานและอัตราค่าเสื่อ.pdf).
 * - Each fiscal year is charged (cost − 1) ÷ life × days held ÷ days in the fiscal year, so full years
 *   carry the whole annual charge and the first/last years are prorated by day. Depreciation stops at a
 *   salvage value of 1 baht, which stays on the register until disposal.
 * - Items priced below the capitalisation threshold are listed but not depreciated.
 * Figures are an operational estimate for planning and reporting, not a general-ledger posting.
 */
export const SALVAGE_VALUE = 1;
export const CAPITALIZATION_THRESHOLD = 10_000;

export type ValuationInput = AssetClassification & {
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  installedAt?: string | null;
  usefulLifeYears?: number | null;
  subtypeName?: string;
  extensions?: Record<string, { subtypeName: string }>;
  currentStatus?: string;
};

export type UsefulLife = {
  years: number | null;
  categoryId: number | null;
  categoryLabel: string;
  rateLabel: string;
  annualRate: number | null;
  source: "override" | "schedule" | "none";
};

export type ValuationStatus = "ok" | "below-threshold" | "missing-price" | "missing-date" | "no-life" | "future";

export type Valuation = {
  status: ValuationStatus;
  cost: number | null;
  startDate: string | null;
  life: UsefulLife;
  annualDepreciation: number;
  accumulated: number;
  bookValue: number | null;
  fullyDepreciatedOn: string | null;
  isFullyDepreciated: boolean;
};

const DAY = 86_400_000;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const stripNumbering = (label: string) => label.replace(/^[\d.]+\s*/, "").trim().toLowerCase().replace(/\s+/g, " ");

function parseDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const toIso = (date: Date) => date.toISOString().slice(0, 10);

function addYears(date: Date, years: number) {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  // 29 Feb + n years rolls to 1 Mar, which matches counting whole years of days.
  return result;
}

/** Thai government fiscal year (Buddhist Era): FY 2570 runs 2026-10-01 to 2027-09-30. */
export function fiscalYearOf(value: string | Date) {
  const date = typeof value === "string" ? parseDate(value) : value;
  if (!date) throw new Error("วันที่ไม่ถูกต้อง");
  const year = date.getUTCFullYear() + (date.getUTCMonth() >= 9 ? 1 : 0);
  return year + 543;
}

export function fiscalYearRange(fiscalYearBE: number) {
  const endYear = fiscalYearBE - 543;
  return { start: `${endYear - 1}-10-01`, end: `${endYear}-09-30` };
}

export function resolveUsefulLife(asset: ValuationInput): UsefulLife {
  const categoryId = dashboardCategoryId(asset);
  const category = DEPRECIATION_CATEGORIES.find(item => item.id === categoryId);
  const subtype = stripNumbering(asset.subtypeName || asset.extensions?.[normalizeAssetClass(asset.assetClass)]?.subtypeName || "");
  const matched = category && subtype
    ? category.rates.find(rate => stripNumbering(rate.label) === subtype) ?? category.rates.find(rate => stripNumbering(rate.label).startsWith(subtype))
    : undefined;
  const rate = matched ?? category?.rates.find(item => item.years !== null) ?? category?.rates[0];
  const base = {
    categoryId: categoryId ?? null,
    categoryLabel: category?.label ?? "ยังไม่จัดประเภทตามตาราง",
    rateLabel: rate?.label ?? "",
    annualRate: rate?.rate ?? null,
  };
  if (asset.usefulLifeYears && asset.usefulLifeYears > 0) {
    return { ...base, years: asset.usefulLifeYears, annualRate: round2(100 / asset.usefulLifeYears), source: "override" };
  }
  if (rate?.years) return { ...base, years: rate.years, source: "schedule" };
  return { ...base, years: null, source: "none" };
}

const dayCount = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY) + 1;

/**
 * Walks fiscal years: each year is charged cost/years × (days held ÷ days in that fiscal year),
 * so every full year carries exactly the annual charge and the first/last years are prorated by day.
 */
function walkDepreciation(cost: number, startDate: string, years: number, asOf: string) {
  const start = parseDate(startDate);
  const until = parseDate(asOf);
  const depreciable = Math.max(0, cost - SALVAGE_VALUE);
  if (!start || !until || years <= 0 || depreciable === 0 || until < start) return { accumulated: 0, fullyDepreciatedOn: null as string | null };
  const annual = depreciable / years;
  let accumulated = 0;
  for (let fiscalYear = fiscalYearOf(start); ; fiscalYear += 1) {
    const range = fiscalYearRange(fiscalYear);
    const fyStart = parseDate(range.start)!;
    const fyEnd = parseDate(range.end)!;
    const periodStart = start > fyStart ? start : fyStart;
    const periodEnd = until < fyEnd ? until : fyEnd;
    const daysInYear = dayCount(fyStart, fyEnd);
    const charge = annual * dayCount(periodStart, periodEnd) / daysInYear;
    if (accumulated + charge >= depreciable - 0.005) {
      const neededDays = Math.ceil(((depreciable - accumulated) / annual) * daysInYear - 1e-9);
      const reachedOn = new Date(periodStart.getTime() + (neededDays - 1) * DAY);
      return { accumulated: depreciable, fullyDepreciatedOn: reachedOn <= until ? toIso(reachedOn) : null, reachedOn: toIso(reachedOn) };
    }
    accumulated += charge;
    if (periodEnd >= until) return { accumulated: round2(accumulated), fullyDepreciatedOn: null };
  }
}

/** Accumulated straight-line depreciation up to and including `asOf`. */
export function accumulatedDepreciation(cost: number, startDate: string, years: number, asOf: string) {
  return round2(walkDepreciation(cost, startDate, years, asOf).accumulated);
}

function fullyDepreciatedDate(cost: number, startDate: string, years: number) {
  const result = walkDepreciation(cost, startDate, years, "9999-09-30") as { reachedOn?: string };
  return result.reachedOn ?? null;
}

export function valueAsset(asset: ValuationInput, asOf: string): Valuation {
  const life = resolveUsefulLife(asset);
  const cost = asset.purchasePrice ?? null;
  const startDate = parseDate(asset.purchaseDate) ? asset.purchaseDate!.slice(0, 10) : parseDate(asset.installedAt) ? asset.installedAt!.slice(0, 10) : null;
  const empty = { cost, startDate, life, annualDepreciation: 0, accumulated: 0, fullyDepreciatedOn: null, isFullyDepreciated: false };
  if (cost === null || !Number.isFinite(cost)) return { ...empty, status: "missing-price", bookValue: null };
  if (cost < CAPITALIZATION_THRESHOLD) return { ...empty, status: "below-threshold", bookValue: cost };
  if (!startDate) return { ...empty, status: "missing-date", bookValue: cost };
  if (!life.years) return { ...empty, status: "no-life", bookValue: cost };
  if (startDate > asOf) return { ...empty, status: "future", bookValue: cost };
  const accumulated = accumulatedDepreciation(cost, startDate, life.years, asOf);
  const fullyDepreciatedOn = fullyDepreciatedDate(cost, startDate, life.years) ?? toIso(new Date(addYears(parseDate(startDate)!, life.years).getTime() - DAY));
  const bookValue = round2(cost - accumulated);
  return {
    status: "ok",
    cost,
    startDate,
    life,
    annualDepreciation: round2(Math.max(0, cost - SALVAGE_VALUE) / life.years),
    accumulated,
    bookValue,
    fullyDepreciatedOn,
    isFullyDepreciated: asOf >= fullyDepreciatedOn,
  };
}

export type ScheduleRow = { fiscalYear: number; start: string; end: string; depreciation: number; accumulated: number; bookValue: number };

/** Per-fiscal-year schedule from acquisition until the asset reaches its salvage value. */
export function depreciationSchedule(asset: ValuationInput): ScheduleRow[] {
  const valuation = valueAsset(asset, "9999-12-31");
  if (valuation.status !== "ok" || !valuation.startDate || !valuation.life.years || valuation.cost === null) return [];
  const rows: ScheduleRow[] = [];
  const firstYear = fiscalYearOf(valuation.startDate);
  const lastYear = fiscalYearOf(valuation.fullyDepreciatedOn!);
  let previous = 0;
  for (let fiscalYear = firstYear; fiscalYear <= lastYear; fiscalYear += 1) {
    const range = fiscalYearRange(fiscalYear);
    const accumulated = accumulatedDepreciation(valuation.cost, valuation.startDate, valuation.life.years, range.end);
    rows.push({ fiscalYear, ...range, depreciation: round2(accumulated - previous), accumulated, bookValue: round2(valuation.cost - accumulated) });
    previous = accumulated;
  }
  return rows;
}

/** Depreciation charged within one fiscal year (0 outside the asset's life). */
export function depreciationForFiscalYear(asset: ValuationInput, fiscalYearBE: number) {
  const { start, end } = fiscalYearRange(fiscalYearBE);
  const valuation = valueAsset(asset, end);
  if (valuation.status !== "ok" || !valuation.startDate || !valuation.life.years || valuation.cost === null) return 0;
  const before = new Date(parseDate(start)!.getTime() - DAY);
  return round2(valuation.accumulated - accumulatedDepreciation(valuation.cost, valuation.startDate, valuation.life.years, toIso(before)));
}

export const VALUATION_STATUS_LABELS: Record<ValuationStatus, string> = {
  ok: "คิดค่าเสื่อม",
  "below-threshold": `ต่ำกว่าเกณฑ์ ${CAPITALIZATION_THRESHOLD.toLocaleString("th-TH")} บาท (ไม่คิดค่าเสื่อม)`,
  "missing-price": "ยังไม่ระบุราคา",
  "missing-date": "ยังไม่ระบุวันที่ได้มา",
  "no-life": "ไม่มีอายุการใช้งานตามตาราง (ระบุอายุเฉพาะรายการ)",
  future: "วันที่ได้มาอยู่หลังวันที่ประเมิน",
};

export type ValuationSummaryRow = {
  categoryId: number | null;
  categoryLabel: string;
  count: number;
  cost: number;
  depreciationThisYear: number;
  accumulated: number;
  bookValue: number;
  fullyDepreciated: number;
};

export type ValuationReport<T> = {
  fiscalYear: number;
  asOf: string;
  rows: ValuationSummaryRow[];
  totals: Omit<ValuationSummaryRow, "categoryId" | "categoryLabel">;
  excluded: Record<Exclude<ValuationStatus, "ok">, number>;
  belowThresholdCost: number;
  terminalCount: number;
  items: Array<{ asset: T; valuation: Valuation; depreciationThisYear: number }>;
};

/** Register valuation for one fiscal year. Disposed/Lost assets are excluded from the register totals. */
export function summarizeValuation<T extends ValuationInput>(assets: T[], fiscalYearBE: number, today = new Date().toISOString().slice(0, 10)): ValuationReport<T> {
  const { end } = fiscalYearRange(fiscalYearBE);
  const asOf = end < today ? end : today;
  const byCategory = new Map<string, ValuationSummaryRow>();
  const totals = { count: 0, cost: 0, depreciationThisYear: 0, accumulated: 0, bookValue: 0, fullyDepreciated: 0 };
  const excluded = { "below-threshold": 0, "missing-price": 0, "missing-date": 0, "no-life": 0, future: 0 };
  let belowThresholdCost = 0;
  let terminalCount = 0;
  const items: ValuationReport<T>["items"] = [];
  for (const asset of assets) {
    if (asset.currentStatus === "Disposed" || asset.currentStatus === "Lost") { terminalCount += 1; continue; }
    const valuation = valueAsset(asset, asOf);
    if (valuation.status !== "ok") {
      excluded[valuation.status] += 1;
      if (valuation.status === "below-threshold") belowThresholdCost += valuation.cost ?? 0;
      items.push({ asset, valuation, depreciationThisYear: 0 });
      continue;
    }
    const depreciationThisYear = depreciationForFiscalYear(asset, fiscalYearBE);
    items.push({ asset, valuation, depreciationThisYear });
    const key = String(valuation.life.categoryId ?? "none");
    const row = byCategory.get(key) ?? { categoryId: valuation.life.categoryId, categoryLabel: valuation.life.categoryLabel, count: 0, cost: 0, depreciationThisYear: 0, accumulated: 0, bookValue: 0, fullyDepreciated: 0 };
    for (const target of [row, totals]) {
      target.count += 1;
      target.cost += valuation.cost ?? 0;
      target.depreciationThisYear += depreciationThisYear;
      target.accumulated += valuation.accumulated;
      target.bookValue += valuation.bookValue ?? 0;
      if (valuation.isFullyDepreciated) target.fullyDepreciated += 1;
    }
    byCategory.set(key, row);
  }
  const roundRow = <R extends typeof totals>(row: R) => ({ ...row, cost: round2(row.cost), depreciationThisYear: round2(row.depreciationThisYear), accumulated: round2(row.accumulated), bookValue: round2(row.bookValue) });
  const rows = [...byCategory.values()].map(roundRow).sort((a, b) => (a.categoryId ?? 99) - (b.categoryId ?? 99));
  return { fiscalYear: fiscalYearBE, asOf, rows, totals: roundRow(totals), excluded, belowThresholdCost: round2(belowThresholdCost), terminalCount, items };
}
