import { ASSET_CLASS_OPTIONS, normalizeAssetClass } from "@/lib/asset-classes";
import type { AssetClassification } from "@/lib/asset-policy";

type ReferenceRate = { label: string; years: number | null; rate: number | null };
type ReferenceCategory = { id: number; label: string; rates: ReferenceRate[] };
const rate = (label: string, years: number | null, annualRate: number | null): ReferenceRate => ({ label, years, rate: annualRate });

/** Transcribed from docs/ตารางกำหนดอายุการใช้งานและอัตราค่าเสื่อ.pdf, pages 1–2.
 * Rates are the document's stated percentages, NOT 100 / useful life.
 * This is a display reference, not a calculation of an asset's book value.
 */
export const DEPRECIATION_CATEGORIES: ReferenceCategory[] = [
  { id: 1, label: "อาคารถาวร", rates: [rate("อาคารถาวร", 25, 4)] },
  { id: 2, label: "สิ่งก่อสร้าง", rates: [
    rate("2.1 อาคารชั่วคราว/โรงเรือน", 10, 10),
    rate("2.2.1 ใช้คอนกรีตเสริมเหล็กหรือโครงเหล็กเป็นส่วนประกอบหลัก", 15, 6.5),
    rate("2.2.2 ใช้ไม้หรือวัสดุอื่นเป็นส่วนประกอบหลัก", 5, 20),
    rate("2.3 งานต่อเติม — คณะกรรมการพิจารณาเป็นรายกรณี", null, null),
    rate("2.4.1 งานปรับปรุง: ไม้/ไม้อัด", 5, 20),
    rate("2.4.2 งานปรับปรุง: แผ่นยิปซั่ม/ลามิเนต/วัสดุคงทนอื่น ๆ", 10, 10),
  ] },
  { id: 3, label: "ครุภัณฑ์สำนักงาน", rates: [rate("ครุภัณฑ์สำนักงาน", 3, 33), rate("ลิฟต์ กรณีเปลี่ยนแทน (บันทึกเป็นสินทรัพย์ย่อย)", 12, 8)] },
  { id: 4, label: "ครุภัณฑ์ยานพาหนะและขนส่ง", rates: [rate("ครุภัณฑ์ยานพาหนะและขนส่ง", 5, 20)] },
  { id: 5, label: "ครุภัณฑ์ไฟฟ้าและวิทยุ", rates: [rate("5.1 ครุภัณฑ์ไฟฟ้าและวิทยุ", 5, 20), rate("5.2 เครื่องกำเนิดไฟฟ้า", 15, 6.5)] },
  { id: 6, label: "ครุภัณฑ์โฆษณาและเผยแพร่", rates: [rate("ครุภัณฑ์โฆษณาและเผยแพร่", 5, 20)] },
  { id: 7, label: "ครุภัณฑ์การเกษตร", rates: [rate("7.1 เครื่องมือและอุปกรณ์", 2, 50), rate("7.2 เครื่องจักรกล", 5, 20)] },
  { id: 8, label: "ครุภัณฑ์โรงงาน", rates: [rate("8.1 เครื่องมือและอุปกรณ์", 2, 50), rate("8.2 เครื่องจักรกล", 5, 20)] },
  { id: 9, label: "ครุภัณฑ์ก่อสร้าง", rates: [rate("9.1 เครื่องมือและอุปกรณ์", 2, 50), rate("9.2 เครื่องจักรกล", 5, 20)] },
  { id: 10, label: "ครุภัณฑ์สำรวจ", rates: [rate("ครุภัณฑ์สำรวจ", 8, 12.5)] },
  { id: 11, label: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์", rates: [rate("ครุภัณฑ์วิทยาศาสตร์และการแพทย์", 5, 20)] },
  { id: 12, label: "ครุภัณฑ์คอมพิวเตอร์", rates: [rate("ครุภัณฑ์คอมพิวเตอร์", 3, 33)] },
  { id: 13, label: "ครุภัณฑ์การศึกษา", rates: [rate("ครุภัณฑ์การศึกษา", 3, 33)] },
  { id: 14, label: "ครุภัณฑ์งานบ้านงานครัว", rates: [rate("ครุภัณฑ์งานบ้านงานครัว", 3, 33)] },
  { id: 15, label: "ครุภัณฑ์กีฬา/กายภาพ", rates: [rate("ครุภัณฑ์กีฬา/กายภาพ", 5, 20)] },
  { id: 16, label: "ครุภัณฑ์ดนตรี/นาฏศิลป์", rates: [rate("ครุภัณฑ์ดนตรี/นาฏศิลป์", 5, 20)] },
  { id: 17, label: "ครุภัณฑ์อาวุธ", rates: [rate("ครุภัณฑ์อาวุธ", 10, 10)] },
  { id: 18, label: "ครุภัณฑ์สนาม", rates: [rate("ครุภัณฑ์สนาม", 2, 50)] },
  { id: 19, label: "ครุภัณฑ์อื่น", rates: [rate("ครุภัณฑ์อื่น", 5, 20)] },
  { id: 20, label: "สินทรัพย์ไม่มีตัวตน", rates: [rate("สินทรัพย์ไม่มีตัวตน", 3, 33)] },
];

type DashboardAsset = AssetClassification & {
  subtypeName?: string;
  extensions?: Record<string, { subtypeName: string }>;
  currentStatus?: string;
};

const normalize = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

/** Use recorded classes/subtypes, never guess from asset names or stale non-IT device fields. */
export function dashboardCategoryId(asset: DashboardAsset): number | null {
  const assetClass = normalizeAssetClass(asset.assetClass);
  if (assetClass === "IT") {
    if ((asset.assetCategory ?? asset.assetGroup) === "Software") return 20;
    if ((asset.assetCategory ?? asset.assetGroup) !== "Hardware") return null;
    return 12;
  }

  const direct = ASSET_CLASS_OPTIONS.find(option => option.value === assetClass);
  // Newly selectable schedule classes are authoritative; legacy broad classes remain reviewable.
  if (direct && direct.categoryId > 0 && !["Office", "Medical", "Vehicle", "Other"].includes(assetClass)) return direct.categoryId;

  const subtype = normalize(asset.subtypeName || asset.extensions?.[assetClass]?.subtypeName);
  // A broad stored class must not overrule a more specific, explicitly recorded type.
  const allowed: Record<string, number[]> = { Office: [3], Medical: [11], Vehicle: [4], Building: [1, 2], Utility: [5], Other: DEPRECIATION_CATEGORIES.map(c => c.id) };
  if (!allowed[assetClass]) return null;
  const exact = DEPRECIATION_CATEGORIES.find(category => normalize(category.label) === subtype);
  if (exact) return allowed[assetClass].includes(exact.id) ? exact.id : null;
  if (assetClass === "Office") return 3;
  if (assetClass === "Medical") return 11;
  if (assetClass === "Vehicle") return 4;
  if (assetClass === "Building" && ["อาคารชั่วคราว/โรงเรือน", "สิ่งปลูกสร้างอื่น", "งานต่อเติม", "งานปรับปรุง"].includes(subtype)) return 2;
  if (assetClass === "Utility" && subtype === "เครื่องกำเนิดไฟฟ้า") return 5;
  if (assetClass === "Other" && !subtype) return 19;
  // Legacy Building/Utility do not identify a reference category reliably.
  return null;
}

export type CategoryCounts = { total: number; active: number; broken: number; inactive: number };
export type DepreciationRow = ReferenceCategory & CategoryCounts;
const emptyCounts = (): CategoryCounts => ({ total: 0, active: 0, broken: 0, inactive: 0 });

export function summarizeDepreciationCategories(assets: DashboardAsset[]) {
  const rows: DepreciationRow[] = DEPRECIATION_CATEGORIES.map(category => ({ ...category, ...emptyCounts() }));
  const unclassified = emptyCounts();
  for (const asset of assets) {
    const id = dashboardCategoryId(asset);
    const counts = rows.find(row => row.id === id) ?? unclassified;
    counts.total += 1;
    if (asset.currentStatus === "Active") counts.active += 1;
    else if (asset.currentStatus === "Broken") counts.broken += 1;
    else if (asset.currentStatus === "Inactive") counts.inactive += 1;
  }
  return { rows, unclassified, total: assets.length };
}
