import { summarizeValuation, type ValuationInput, type ValuationReport } from "@/lib/asset-valuation";

/**
 * รายงานสรุปมูลค่าคงเหลือครุภัณฑ์ (พิมพ์ A4) — ตัวกรอง + สรุปแยกหน่วยงาน
 * ตัวเลขทั้งหมดมาจาก summarizeValuation เพื่อให้ตรงกับหน้ารายงานและไฟล์ CSV
 */
export type ValuationSheetAsset = ValuationInput & {
  id: number;
  assetName: string;
  assetRegistrationNo?: string | null;
  facilityId: number;
  facilityName: string;
  assetClass: string;
};

export type ValuationSheetFilter = { assetClass?: string; facilityId?: number };

export function filterValuationAssets<T extends ValuationSheetAsset>(assets: T[], filter: ValuationSheetFilter): T[] {
  return assets.filter(
    (asset) =>
      (!filter.assetClass || asset.assetClass === filter.assetClass) &&
      (!filter.facilityId || Number(asset.facilityId) === Number(filter.facilityId))
  );
}

export type ValuationFacilityRow = {
  facilityId: number;
  facilityName: string;
  totals: ValuationReport<unknown>["totals"];
};

export function buildValuationSheet<T extends ValuationSheetAsset>(assets: T[], fiscalYearBE: number, today: string) {
  const report = summarizeValuation(assets, fiscalYearBE, today);
  const groups = new Map<number, { name: string; items: T[] }>();
  for (const asset of assets) {
    const group = groups.get(asset.facilityId) ?? { name: asset.facilityName, items: [] };
    group.items.push(asset);
    groups.set(asset.facilityId, group);
  }
  const byFacility: ValuationFacilityRow[] = [...groups.entries()]
    .map(([facilityId, group]) => ({ facilityId, facilityName: group.name, totals: summarizeValuation(group.items, fiscalYearBE, today).totals }))
    .sort((a, b) => a.facilityName.localeCompare(b.facilityName, "th"));
  return { report, byFacility };
}
