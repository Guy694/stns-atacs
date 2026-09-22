// Category numbers follow the supplied useful-life schedule. Stored legacy codes remain valid.
export const ASSET_CLASS_OPTIONS = [
  { value: "PermanentBuilding", label: "อาคารถาวร", shortLabel: "อาคารถาวร", categoryId: 1 },
  { value: "Structure", label: "สิ่งก่อสร้าง", shortLabel: "สิ่งก่อสร้าง", categoryId: 2 },
  { value: "Office", label: "ครุภัณฑ์สำนักงาน", shortLabel: "สำนักงาน", categoryId: 3 },
  { value: "Vehicle", label: "ครุภัณฑ์ยานพาหนะและขนส่ง", shortLabel: "ยานพาหนะและขนส่ง", categoryId: 4 },
  { value: "Electrical", label: "ครุภัณฑ์ไฟฟ้าและวิทยุ", shortLabel: "ไฟฟ้าและวิทยุ", categoryId: 5 },
  { value: "Advertising", label: "ครุภัณฑ์โฆษณาและเผยแพร่", shortLabel: "โฆษณาและเผยแพร่", categoryId: 6 },
  { value: "Agricultural", label: "ครุภัณฑ์การเกษตร", shortLabel: "การเกษตร", categoryId: 7 },
  { value: "Factory", label: "ครุภัณฑ์โรงงาน", shortLabel: "โรงงาน", categoryId: 8 },
  { value: "Construction", label: "ครุภัณฑ์ก่อสร้าง", shortLabel: "ก่อสร้าง", categoryId: 9 },
  { value: "Survey", label: "ครุภัณฑ์สำรวจ", shortLabel: "สำรวจ", categoryId: 10 },
  { value: "Medical", label: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์", shortLabel: "วิทยาศาสตร์และการแพทย์", categoryId: 11 },
  { value: "IT", label: "ครุภัณฑ์คอมพิวเตอร์", shortLabel: "คอมพิวเตอร์", categoryId: 12 },
  { value: "Education", label: "ครุภัณฑ์การศึกษา", shortLabel: "การศึกษา", categoryId: 13 },
  { value: "Kitchen", label: "ครุภัณฑ์งานบ้านงานครัว", shortLabel: "งานบ้านงานครัว", categoryId: 14 },
  { value: "Sports", label: "ครุภัณฑ์กีฬา/กายภาพ", shortLabel: "กีฬา/กายภาพ", categoryId: 15 },
  { value: "Music", label: "ครุภัณฑ์ดนตรี/นาฏศิลป์", shortLabel: "ดนตรี/นาฏศิลป์", categoryId: 16 },
  { value: "Weapons", label: "ครุภัณฑ์อาวุธ", shortLabel: "อาวุธ", categoryId: 17 },
  { value: "Field", label: "ครุภัณฑ์สนาม", shortLabel: "สนาม", categoryId: 18 },
  { value: "Other", label: "ครุภัณฑ์อื่น", shortLabel: "อื่นๆ", categoryId: 19 },
  { value: "Intangible", label: "สินทรัพย์ไม่มีตัวตน", shortLabel: "สินทรัพย์ไม่มีตัวตน", categoryId: 20 },
  { value: "Building", label: "อาคาร / สิ่งปลูกสร้าง (กลุ่มเดิม)", shortLabel: "อาคาร/สิ่งปลูกสร้าง", categoryId: 0 },
  { value: "Utility", label: "ระบบสาธารณูปโภค (กลุ่มเดิม)", shortLabel: "สาธารณูปโภค", categoryId: 0 },
] as const;

export const ASSET_CREATE_CLASS_OPTIONS = ASSET_CLASS_OPTIONS.filter(option => option.categoryId > 0);

export type AssetClassCode = (typeof ASSET_CLASS_OPTIONS)[number]["value"];

export const ASSET_CLASS_VALUES = ASSET_CLASS_OPTIONS.map((option) => option.value);
export const ASSET_CLASS_VALUE_SET = new Set<string>(ASSET_CLASS_VALUES);

export function normalizeAssetClass(value?: string | null): string {
  // Preserve unrecognized stored values for review; only missing legacy values mean IT.
  return value?.trim() || "IT";
}

export function assetClassLabel(value?: string | null, variant: "short" | "full" = "short") {
  const normalized = normalizeAssetClass(value);
  const option = ASSET_CLASS_OPTIONS.find((item) => item.value === normalized);
  return variant === "full" ? option?.label ?? normalized : option?.shortLabel ?? normalized;
}
