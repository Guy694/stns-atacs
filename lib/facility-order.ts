/**
 * Provincial order for health facilities, used by every facility list and dropdown:
 * สสจ. → สสอ. → รพ.ทั่วไป → รพ.ชุมชน → รพ.สต. (incl. สอน.) → ศสช. → others.
 */
export type OrderableFacility = { name: string; typecode?: string | null };

const TYPE_ORDER: { codes: string[]; prefix: RegExp; label: string }[] = [
  { codes: ["สสจ."], prefix: /^สสจ\./, label: "สำนักงานสาธารณสุขจังหวัด" },
  { codes: ["สสอ."], prefix: /^สสอ\./, label: "สำนักงานสาธารณสุขอำเภอ" },
  { codes: ["รพ.ทั่วไป", "รพท.", "รพศ."], prefix: /^(รพท\.|รพศ\.)/, label: "โรงพยาบาลทั่วไป" },
  { codes: ["รพ.ชุมชน", "รพช."], prefix: /^(รพช\.|รพ\.(?!สต\.))/, label: "โรงพยาบาลชุมชน" },
  { codes: ["รพ.สต.", "สอน."], prefix: /^(รพ\.สต\.|สอน\.)/, label: "รพ.สต." },
  { codes: ["ศสช."], prefix: /^ศสช\./, label: "ศูนย์สุขภาพชุมชน" },
];
const OTHER_RANK = TYPE_ORDER.length;

export function facilityTypeRank(facility: OrderableFacility): number {
  const code = facility.typecode?.trim();
  if (code) {
    const index = TYPE_ORDER.findIndex((type) => type.codes.includes(code));
    if (index >= 0) return index;
  }
  const name = facility.name.trim();
  const byName = TYPE_ORDER.findIndex((type) => type.prefix.test(name));
  return byName >= 0 ? byName : OTHER_RANK;
}

/** สอน. sorts after รพ.สต. inside the same group so the 54 รพ.สต. stay together. */
function subRank(facility: OrderableFacility) {
  return facility.typecode?.trim() === "สอน." || /^สอน\./.test(facility.name) ? 1 : 0;
}

export function facilityGroupLabel(facility: OrderableFacility): string {
  return TYPE_ORDER[facilityTypeRank(facility)]?.label ?? "อื่น ๆ";
}

const collator = new Intl.Collator("th");

export function compareFacilities(a: OrderableFacility, b: OrderableFacility): number {
  return facilityTypeRank(a) - facilityTypeRank(b) || subRank(a) - subRank(b) || collator.compare(a.name, b.name);
}

export function sortFacilities<T extends OrderableFacility>(facilities: readonly T[]): T[] {
  return [...facilities].sort(compareFacilities);
}

/** SQL ORDER BY fragment with the same order, for queries that already sort in MySQL. */
export function facilityOrderSql(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `CASE
    WHEN ${p}typecode = 'สสจ.' OR ${p}name LIKE 'สสจ.%' THEN 0
    WHEN ${p}typecode = 'สสอ.' OR ${p}name LIKE 'สสอ.%' THEN 1
    WHEN ${p}typecode IN ('รพ.ทั่วไป','รพท.','รพศ.') THEN 2
    WHEN ${p}typecode IN ('รพ.ชุมชน','รพช.') THEN 3
    WHEN ${p}typecode = 'รพ.สต.' OR ${p}name LIKE 'รพ.สต.%' THEN 4
    WHEN ${p}typecode = 'สอน.' THEN 5
    WHEN ${p}typecode = 'ศสช.' THEN 6
    ELSE 7 END, ${p}name`;
}
