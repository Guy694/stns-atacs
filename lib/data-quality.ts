/**
 * Data completeness of the asset register (pure definitions and scoring; queries live in lib/data-quality-db.ts).
 * Only assets still on the register count — disposed and lost items are history.
 *
 * `missing` is a SQL condition over `a` (information_assets) that is true when the value is missing;
 * `applies` narrows which assets the check is about (e.g. the asset code only matters for capitalised items).
 * `requires` names the migration that adds the column, so older databases skip the check instead of failing.
 */
export type QualityCheck = {
  key: string;
  label: string;
  hint: string;
  missing: string;
  applies?: string;
  requires?: "codes" | "acquisition";
};

const blank = (column: string) => `NULLIF(TRIM(${column}), '') IS NULL`;

export const QUALITY_CHECKS: QualityCheck[] = [
  { key: "number", label: "เลขครุภัณฑ์", hint: "ใช้อ้างอิงในใบตรวจนับและเอกสารจำหน่าย", missing: blank("a.asset_registration_no") },
  { key: "price", label: "มูลค่าที่ได้มา", hint: "จำเป็นต่อการคิดค่าเสื่อมและมูลค่ารวม", missing: "a.purchase_price IS NULL" },
  { key: "date", label: "วันที่ได้มา", hint: "ใช้กำหนดปีงบประมาณและค่าเสื่อม", missing: "a.purchase_date IS NULL AND a.installed_at IS NULL" },
  { key: "workGroup", label: "กลุ่มงานที่ใช้ประจำ", hint: "ใช้แบ่งรอบตรวจนับตามกลุ่มงาน", missing: "a.work_group_id IS NULL" },
  { key: "location", label: "ที่ตั้ง", hint: "ช่วยให้คณะกรรมการหาเจอเวลาตรวจนับ", missing: blank("a.location_detail") },
  { key: "accountingCode", label: "รหัสสินทรัพย์ (ราคา 10,000 บาทขึ้นไป)", hint: "ใช้กระทบยอดกับบัญชีสินทรัพย์", missing: blank("a.asset_accounting_code"), applies: "a.purchase_price >= 10000", requires: "codes" },
  { key: "funding", label: "แหล่งเงิน", hint: "เงินงบประมาณ เงินบำรุง เงินบริจาค ฯลฯ", missing: blank("a.funding_source"), requires: "acquisition" },
  { key: "method", label: "วิธีการได้มา", hint: "e-bidding, เฉพาะเจาะจง, รับบริจาค ฯลฯ", missing: blank("a.acquisition_method"), requires: "acquisition" },
];

export function qualityCheck(key: string) {
  return QUALITY_CHECKS.find((check) => check.key === key) ?? null;
}

/** Counts per check for one facility: how many assets the check applies to and how many are missing it. */
export type FacilityQualityRow = {
  facilityId: number;
  facilityName: string;
  districtName: string;
  assets: number;
  checks: Record<string, { applicable: number; missing: number }>;
};

export type QualityGrade = "good" | "fair" | "poor";

export function qualityGrade(score: number): QualityGrade {
  if (score >= 0.9) return "good";
  if (score >= 0.7) return "fair";
  return "poor";
}

export const QUALITY_GRADE_LABELS: Record<QualityGrade, string> = { good: "ครบถ้วนดี", fair: "ควรเติมข้อมูล", poor: "ข้อมูลไม่ครบ" };

/** Score = filled cells / applicable cells over the checks available in this database. */
export function scoreFacility(row: FacilityQualityRow, availableKeys: string[]) {
  let applicable = 0;
  let missing = 0;
  for (const key of availableKeys) {
    const counts = row.checks[key];
    if (!counts) continue;
    applicable += counts.applicable;
    missing += Math.min(counts.missing, counts.applicable);
  }
  const score = applicable ? (applicable - missing) / applicable : 1;
  return { applicable, missing, score, grade: qualityGrade(score) };
}

export function summarizeQuality(rows: FacilityQualityRow[], availableKeys: string[]) {
  const facilities = rows
    .map((row) => ({ ...row, ...scoreFacility(row, availableKeys) }))
    .sort((a, b) => a.score - b.score || b.assets - a.assets || a.facilityName.localeCompare(b.facilityName, "th"));
  const checkTotals = availableKeys.map((key) => {
    const applicable = rows.reduce((sum, row) => sum + (row.checks[key]?.applicable ?? 0), 0);
    const missing = rows.reduce((sum, row) => sum + Math.min(row.checks[key]?.missing ?? 0, row.checks[key]?.applicable ?? 0), 0);
    const check = qualityCheck(key)!;
    return { key, label: check.label, hint: check.hint, applicable, missing, rate: applicable ? (applicable - missing) / applicable : 1 };
  });
  const total = scoreFacility(
    { facilityId: 0, facilityName: "", districtName: "", assets: 0, checks: Object.fromEntries(checkTotals.map((c) => [c.key, { applicable: c.applicable, missing: c.missing }])) },
    availableKeys
  );
  return { facilities, checkTotals, total: { ...total, assets: rows.reduce((sum, row) => sum + row.assets, 0) } };
}

/** Serial numbers that look like placeholders are not treated as duplicates. */
export const SERIAL_PLACEHOLDERS = ["-", "--", "N/A", "NA", "NONE", "ไม่มี", "ไม่ระบุ", "0"];

export function isMeaningfulSerial(serial: string | null | undefined) {
  const text = (serial ?? "").trim();
  return text.length >= 3 && !SERIAL_PLACEHOLDERS.includes(text.toUpperCase());
}
