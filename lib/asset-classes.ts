export const ASSET_CLASS_OPTIONS = [
  { value: "IT", label: "ครุภัณฑ์ IT / สารสนเทศ", shortLabel: "ครุภัณฑ์ IT" },
  { value: "Office", label: "ครุภัณฑ์สำนักงาน", shortLabel: "สำนักงาน" },
  { value: "Medical", label: "ครุภัณฑ์การแพทย์", shortLabel: "การแพทย์" },
  { value: "Vehicle", label: "ยานพาหนะ", shortLabel: "ยานพาหนะ" },
  { value: "Building", label: "อาคาร / สิ่งปลูกสร้าง", shortLabel: "อาคาร/สิ่งปลูกสร้าง" },
  { value: "Utility", label: "ระบบสาธารณูปโภค", shortLabel: "สาธารณูปโภค" },
  { value: "Other", label: "อื่นๆ", shortLabel: "อื่นๆ" },
] as const;

export type AssetClassCode = (typeof ASSET_CLASS_OPTIONS)[number]["value"];

export const ASSET_CLASS_VALUES = ASSET_CLASS_OPTIONS.map((option) => option.value);
export const ASSET_CLASS_VALUE_SET = new Set<string>(ASSET_CLASS_VALUES);

export function normalizeAssetClass(value?: string | null): AssetClassCode {
  const trimmed = value?.trim();
  return ASSET_CLASS_VALUE_SET.has(trimmed ?? "") ? (trimmed as AssetClassCode) : "IT";
}

export function assetClassLabel(value?: string | null, variant: "short" | "full" = "short") {
  const normalized = normalizeAssetClass(value);
  const option = ASSET_CLASS_OPTIONS.find((item) => item.value === normalized);
  return variant === "full" ? option?.label ?? normalized : option?.shortLabel ?? normalized;
}
