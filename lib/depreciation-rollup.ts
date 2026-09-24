import { fiscalYearRange, valueAsset, depreciationForFiscalYear, type ValuationInput } from "@/lib/asset-valuation";

/**
 * งบแสดงการเปลี่ยนแปลงค่าเสื่อมราคาต่อปีงบประมาณ (สำหรับส่งงานการเงิน)
 *
 * ยอดยกมา (ค่าเสื่อมสะสม ณ 30 ก.ย. ปีก่อน) + ค่าเสื่อมปีนี้ = ยอดยกไป (ณ 30 ก.ย. ปีนี้)
 * แยกตามหน่วยงาน และรวมทั้งหมด โดยไม่นับครุภัณฑ์ที่จำหน่าย/สูญหายแล้ว
 */
export type RollupAsset = ValuationInput & {
  facilityId?: number | null;
  facilityName?: string | null;
};

export type DepreciationRollupRow = {
  facilityId: number | null;
  facilityName: string;
  /** จำนวนรายการที่คิดค่าเสื่อมได้ */
  count: number;
  /** รายการที่ยังคิดค่าเสื่อมไม่ได้ (ขาดราคา/วันที่/อายุการใช้งาน) */
  incomplete: number;
  cost: number;
  openingAccumulated: number;
  depreciationThisYear: number;
  closingAccumulated: number;
  closingBookValue: number;
  fullyDepreciated: number;
};

export type DepreciationRollup = {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  rows: DepreciationRollupRow[];
  totals: Omit<DepreciationRollupRow, "facilityId" | "facilityName">;
  /** จำนวนที่ไม่นับเพราะจำหน่าย/สูญหายแล้ว */
  excludedTerminal: number;
  /** true เมื่อ ยอดยกมา + ค่าเสื่อมปีนี้ = ยอดยกไป (คลาดเคลื่อนได้ไม่เกิน 1 สตางค์ต่อรายการ) */
  balanced: boolean;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;

function dayBefore(iso: string) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - DAY).toISOString().slice(0, 10);
}

const emptyRow = () => ({
  count: 0, incomplete: 0, cost: 0, openingAccumulated: 0,
  depreciationThisYear: 0, closingAccumulated: 0, closingBookValue: 0, fullyDepreciated: 0,
});

export function buildDepreciationRollup(assets: RollupAsset[], fiscalYearBE: number): DepreciationRollup {
  const { start, end } = fiscalYearRange(fiscalYearBE);
  const openingAsOf = dayBefore(start);

  const byFacility = new Map<string, DepreciationRollupRow>();
  const totals = emptyRow();
  let excludedTerminal = 0;

  for (const asset of assets) {
    if (asset.currentStatus === "Disposed" || asset.currentStatus === "Lost") {
      excludedTerminal += 1;
      continue;
    }

    const key = String(asset.facilityId ?? "none");
    const row = byFacility.get(key) ?? {
      facilityId: asset.facilityId ?? null,
      facilityName: asset.facilityName ?? "ไม่ระบุหน่วยงาน",
      ...emptyRow(),
    };

    const closing = valueAsset(asset, end);
    if (closing.status !== "ok") {
      row.incomplete += 1;
      totals.incomplete += 1;
      byFacility.set(key, row);
      continue;
    }

    const opening = valueAsset(asset, openingAsOf);
    const openingAccumulated = opening.status === "ok" ? opening.accumulated : 0;
    const thisYear = depreciationForFiscalYear(asset, fiscalYearBE);

    for (const target of [row, totals]) {
      target.count += 1;
      target.cost += closing.cost ?? 0;
      target.openingAccumulated += openingAccumulated;
      target.depreciationThisYear += thisYear;
      target.closingAccumulated += closing.accumulated;
      target.closingBookValue += closing.bookValue ?? 0;
      if (closing.isFullyDepreciated) target.fullyDepreciated += 1;
    }
    byFacility.set(key, row);
  }

  const round = <T extends ReturnType<typeof emptyRow>>(row: T): T => ({
    ...row,
    cost: round2(row.cost),
    openingAccumulated: round2(row.openingAccumulated),
    depreciationThisYear: round2(row.depreciationThisYear),
    closingAccumulated: round2(row.closingAccumulated),
    closingBookValue: round2(row.closingBookValue),
  });

  const rows = [...byFacility.values()]
    .map((row) => ({ ...round(row), facilityId: row.facilityId, facilityName: row.facilityName }))
    .sort((a, b) => b.closingBookValue - a.closingBookValue || a.facilityName.localeCompare(b.facilityName, "th"));
  const roundedTotals = round(totals);

  // ความคลาดเคลื่อนจากการปัดเศษต่อรายการไม่ควรเกิน 1 สตางค์
  const drift = Math.abs(roundedTotals.openingAccumulated + roundedTotals.depreciationThisYear - roundedTotals.closingAccumulated);
  const balanced = drift <= Math.max(0.01, roundedTotals.count * 0.01);

  return { fiscalYear: fiscalYearBE, periodStart: start, periodEnd: end, rows, totals: roundedTotals, excludedTerminal, balanced };
}
