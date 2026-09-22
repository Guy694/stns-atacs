/** How an asset was acquired and paid for — printed on the asset card and used for data-completeness checks. */
export const FUNDING_SOURCES = [
  { value: "Budget", label: "เงินงบประมาณ" },
  { value: "Maintenance", label: "เงินบำรุง" },
  { value: "Fund", label: "เงินกองทุน (เช่น UC)" },
  { value: "Donation", label: "เงินบริจาค" },
  { value: "Other", label: "อื่น ๆ" },
] as const;

export const ACQUISITION_METHODS = [
  { value: "EBidding", label: "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)" },
  { value: "EMarket", label: "ตลาดอิเล็กทรอนิกส์ (e-market)" },
  { value: "Selection", label: "คัดเลือก" },
  { value: "Specific", label: "เฉพาะเจาะจง" },
  { value: "Donation", label: "รับบริจาค" },
  { value: "Transfer", label: "รับโอนจากหน่วยงานอื่น" },
  { value: "Other", label: "อื่น ๆ" },
] as const;

export type FundingSource = (typeof FUNDING_SOURCES)[number]["value"];
export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number]["value"];

export const VENDOR_NAME_MAX = 255;
export const UNIT_NAME_MAX = 30;

type Option = { value: string; label: string };
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "");

/** Accepts the stored code or its Thai label (for imports); "" clears; anything else is null. */
function resolve(options: readonly Option[], raw: string): string | null {
  const text = raw.trim();
  if (!text) return "";
  const key = normalize(text);
  const alias = (label: string) => /\(([^)]+)\)/.exec(label)?.[1] ?? "";
  const match = options.find((option) => [option.value, option.label, alias(option.label)].some((candidate) => candidate && normalize(candidate) === key));
  return match ? match.value : null;
}

export function parseFundingSource(raw: string) {
  const value = resolve(FUNDING_SOURCES, raw);
  if (value === null) throw new Error(`แหล่งเงินไม่ถูกต้อง ใช้ได้: ${FUNDING_SOURCES.map((o) => `${o.value} (${o.label})`).join(", ")}`);
  return value;
}

export function parseAcquisitionMethod(raw: string) {
  const value = resolve(ACQUISITION_METHODS, raw);
  if (value === null) throw new Error(`วิธีการได้มาไม่ถูกต้อง ใช้ได้: ${ACQUISITION_METHODS.map((o) => `${o.value} (${o.label})`).join(", ")}`);
  return value;
}

export function fundingSourceLabel(value?: string | null) {
  return FUNDING_SOURCES.find((o) => o.value === value)?.label ?? (value || "");
}

export function acquisitionMethodLabel(value?: string | null) {
  return ACQUISITION_METHODS.find((o) => o.value === value)?.label ?? (value || "");
}
