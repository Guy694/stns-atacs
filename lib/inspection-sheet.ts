import { dashboardCategoryId, DEPRECIATION_CATEGORIES } from "@/lib/asset-depreciation";
import { assetStatusLabel } from "@/lib/asset-status";
import { CAPITALIZATION_THRESHOLD } from "@/lib/asset-valuation";
import { safeSheetName, writeWorkbook, type Cell, type CellStyle, type SheetSpec } from "@/lib/xlsx-writer";

/** Item fields this module needs (a subset of InspectionItem, kept structural for tests). */
export type SheetItem = {
  id: number;
  assetId: number;
  assetName: string;
  assetRegistrationNo: string;
  currentStatus: string;
  inspectionStatus: "Pending" | "Found" | "Missing";
  assetClass: string;
  assetGroup: "Hardware" | "Software";
  subtypeName: string;
  workGroupId: number | null;
  workGroupName: string;
  locationDetail: string;
  purchaseDate: string;
  installedAt: string;
  purchasePrice: number | null;
  assetNumber?: string;
  assetAccountingCode?: string;
  inspectionAssetStatus?: string;
  /** Where the item was found during the check, if recorded (see add_inspection_found_location.sql). */
  foundWorkGroupId?: number | null;
  foundWorkGroupName?: string;
  foundLocation?: string;
  /** Work group on the register when it was checked (the register may be updated afterwards). */
  registeredWorkGroupId?: number | null;
  registeredWorkGroupName?: string;
};

export type InspectionItemFilters = { category: string; location: string; result: string };

export const NO_WORK_GROUP = "none";
export const RESULT_OPTIONS = [
  { value: "Pending", label: "รอตรวจ" },
  { value: "Found", label: "พบ" },
  { value: "Missing", label: "ไม่พบ" },
] as const;

export function readInspectionItemFilters(params: Record<string, string | string[] | undefined> | URLSearchParams): InspectionItemFilters {
  const read = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  };
  const location = read("location");
  const result = read("result");
  return {
    category: /^(\d{1,2}|unclassified)$/.test(read("category")) ? read("category") : "",
    location: location === NO_WORK_GROUP || /^\d+$/.test(location) ? location : "",
    result: RESULT_OPTIONS.some((option) => option.value === result) ? result : "",
  };
}

export function itemCategory(item: SheetItem) {
  const id = dashboardCategoryId({ ...item, assetCategory: item.assetGroup });
  return id === null
    ? { key: "unclassified", label: "รอตรวจสอบประเภท" }
    : { key: String(id), label: DEPRECIATION_CATEGORIES.find((category) => category.id === id)?.label ?? String(id) };
}

/** "Where it is kept": the owning work group first, then the recorded location. */
export function itemLocation(item: SheetItem) {
  const location = item.locationDetail && item.locationDetail !== "ไม่ระบุ" ? item.locationDetail.trim() : "";
  if (item.workGroupName) return location ? `${item.workGroupName} (${location})` : item.workGroupName;
  return location || "ไม่ระบุกลุ่มงาน";
}

const cleanLocation = (value?: string) => (value && value.trim() !== "ไม่ระบุ" ? value.trim() : "");

/** The register's work group at check time (falls back to the current one when not snapshotted). */
export function registeredLocation(item: SheetItem) {
  const snapshot = item.registeredWorkGroupId != null && item.registeredWorkGroupName;
  const group = snapshot ? item.registeredWorkGroupName! : item.workGroupName;
  const location = cleanLocation(item.locationDetail);
  if (group) return location ? `${group} (${location})` : group;
  return location || "ไม่ระบุกลุ่มงาน";
}

/** True when the item was found in a different work group or place than the register says. */
export function isFoundElsewhere(item: SheetItem) {
  if (item.inspectionStatus !== "Found") return false;
  const registeredGroup = item.registeredWorkGroupId ?? item.workGroupId ?? null;
  if (item.foundWorkGroupId != null && item.foundWorkGroupId !== registeredGroup) return true;
  const found = cleanLocation(item.foundLocation);
  return Boolean(found && found !== cleanLocation(item.locationDetail));
}

/** "กลุ่มงาน (ที่ตั้ง)" where it was found, or "" when nothing different was recorded. */
export function foundLocationText(item: SheetItem) {
  if (!isFoundElsewhere(item)) return "";
  const group = item.foundWorkGroupId != null ? item.foundWorkGroupName || "กลุ่มงานอื่น" : item.registeredWorkGroupName || item.workGroupName;
  const place = cleanLocation(item.foundLocation);
  return [group, place && `(${place})`].filter(Boolean).join(" ") || place;
}

export function filterInspectionItems<T extends SheetItem>(items: T[], filters: InspectionItemFilters) {
  return items.filter((item) =>
    (!filters.category || itemCategory(item).key === filters.category) &&
    (!filters.location || (filters.location === NO_WORK_GROUP ? item.workGroupId === null : String(item.workGroupId) === filters.location)) &&
    (!filters.result || item.inspectionStatus === filters.result));
}

/** Options come from the items in the round, so only groups/types that exist are offered. */
export function inspectionFilterOptions(items: SheetItem[]) {
  const categories = new Map<string, { key: string; label: string; count: number }>();
  const locations = new Map<string, { value: string; label: string; count: number }>();
  for (const item of items) {
    const category = itemCategory(item);
    const entry = categories.get(category.key) ?? { ...category, count: 0 };
    entry.count += 1;
    categories.set(category.key, entry);
    const key = item.workGroupId === null ? NO_WORK_GROUP : String(item.workGroupId);
    const location = locations.get(key) ?? { value: key, label: item.workGroupId === null ? "ไม่ระบุกลุ่มงาน" : item.workGroupName || `กลุ่มงาน #${item.workGroupId}`, count: 0 };
    location.count += 1;
    locations.set(key, location);
  }
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "th");
  return {
    categories: [...categories.values()].sort((a, b) => (a.key === "unclassified" ? 1 : b.key === "unclassified" ? -1 : Number(a.key) - Number(b.key))),
    locations: [...locations.values()].sort((a, b) => (a.value === NO_WORK_GROUP ? 1 : b.value === NO_WORK_GROUP ? -1 : byLabel(a, b))),
  };
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Thai date as printed on count sheets, e.g. 7 ธ.ค. 2561. */
export function thaiDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return "";
  return `${Number(match[3])} ${THAI_MONTHS[Number(match[2]) - 1]} ${Number(match[1]) + 543}`;
}

export const SHEET_HEADERS = [
  "ลำดับที่", "วัน เดือน ปี ที่ได้มา", "เลขครุภัณฑ์", "รหัสสินทรัพย์", "รายการ",
  "จำนวนหน่วย", "มูลค่าการได้มา", "มูลค่ารวม", "ใช้ประจำที่ไหน", "สถานะพัสดุ",
] as const;

const BELOW_THRESHOLD_LABEL = "ต่ำกว่าเกณฑ์";

/** Rows in walking order: grouped by where the item is kept, then by asset number. */
export function sheetRows(items: SheetItem[]) {
  return [...items]
    .sort((a, b) => itemLocation(a).localeCompare(itemLocation(b), "th") || (a.assetNumber || a.assetRegistrationNo).localeCompare(b.assetNumber || b.assetRegistrationNo, "th", { numeric: true }) || a.id - b.id)
    .map((item, index) => ({
      order: index + 1,
      acquired: thaiDate(item.purchaseDate || item.installedAt),
      assetCode: item.assetNumber || item.assetRegistrationNo,
      // Items below the capitalisation threshold carry no accounting asset code.
      accountingCode: item.assetAccountingCode || (item.purchasePrice !== null && item.purchasePrice < CAPITALIZATION_THRESHOLD ? BELOW_THRESHOLD_LABEL : ""),
      name: item.assetName,
      quantity: 1,
      unitValue: item.purchasePrice,
      // Register first; where it was actually found is added below when different.
      location: isFoundElsewhere(item)
        ? `${item.registeredWorkGroupName || item.workGroupName || itemLocation(item)}\nพบที่: ${foundLocationText(item)}`
        : item.workGroupName || itemLocation(item),
      // Left blank for the committee unless this round already recorded a result.
      status: item.inspectionStatus === "Missing" ? "ไม่พบ" : item.inspectionStatus === "Found" ? assetStatusLabel(item.inspectionAssetStatus || item.currentStatus || "Active") : "",
    }));
}

export type SheetMeta = {
  roundName: string;
  facilityName: string;
  districtName: string;
  workGroupName: string;
  filterLabel: string;
  committee: Array<{ seq: number; role?: "chair" | "member"; fullName: string; position: string }>;
  /** เลขที่และวันที่คำสั่งแต่งตั้งคณะกรรมการ (optional). */
  committeeOrderNo?: string;
  committeeOrderDate?: string;
};

/** "ตามคำสั่งแต่งตั้งคณะกรรมการ ที่ 12/2570 ลงวันที่ 1 ต.ค. 2569" or "" when nothing was recorded. */
export function committeeOrderText(meta: Pick<SheetMeta, "committeeOrderNo" | "committeeOrderDate">) {
  const no = meta.committeeOrderNo?.trim();
  const date = meta.committeeOrderDate ? thaiDate(meta.committeeOrderDate) : "";
  if (!no && !date) return "";
  return `ตามคำสั่งแต่งตั้งคณะกรรมการตรวจสอบพัสดุ${no ? ` ที่ ${no}` : ""}${date ? ` ลงวันที่ ${date}` : ""}`;
}

const COLS = [7, 13, 30, 17, 46, 9, 14, 14, 24, 14];
const LAST_COL = "J";
const border = { border: true, v: "center" as const };
export const sheetStyle = {
  title: { bold: true, size: 14, h: "center" as const },
  subtitle: { bold: true, size: 12, h: "center" as const },
  note: { size: 9, h: "center" as const, color: "595959" },
  band: { bold: true, size: 12, h: "center" as const, fill: "C6E0B4", border: true },
  header: { bold: true, size: 10, h: "center" as const, wrap: true, border: true, fill: "F2F2F2" },
  text: { ...border, size: 10 },
  wrapText: { ...border, size: 10, wrap: true },
  center: { ...border, size: 10, h: "center" as const },
  small: { ...border, size: 9, wrap: true },
  money: { ...border, size: 10, h: "right" as const, numFmt: "#,##0.00" },
  totalLabel: { ...border, bold: true, size: 10, h: "right" as const },
  totalCount: { ...border, bold: true, size: 10, h: "center" as const },
  totalMoney: { ...border, bold: true, size: 10, h: "right" as const, numFmt: "#,##0.00" },
  sign: { size: 11, h: "center" as const },
} satisfies Record<string, CellStyle>;
const style = sheetStyle;

const ROLE_LABELS = ["ประธานกรรมการ", "กรรมการ", "กรรมการ", "กรรมการ"];

/** Signature block: chair first, then members, two per row (left A–E, right F–J); blank lines when missing. */
export function appendSignatures(rows: Cell[][], merges: string[], heights: Record<number, number>, committee: SheetMeta["committee"]) {
  const saved = [...committee].sort((a, b) => (a.role === "chair" ? 0 : 1) - (b.role === "chair" ? 0 : 1) || a.seq - b.seq);
  const members = Array.from({ length: 4 }, (_, index) => saved[index]);
  const roleLabel = (index: number) => {
    const role = members[index]?.role;
    return role === "chair" ? "ประธานกรรมการ" : role === "member" ? "กรรมการ" : ROLE_LABELS[index];
  };
  for (let pair = 0; pair < 2; pair += 1) {
    const lines = [0, 1].map((side) => {
      const index = pair * 2 + side;
      const member = members[index];
      return [
        `ลงชื่อ ...................................................... ${roleLabel(index)}`,
        member?.fullName ? `(${member.fullName})` : "(......................................................)",
        member?.position ? `ตำแหน่ง ${member.position}` : "ตำแหน่ง ..................................................",
      ];
    });
    for (let line = 0; line < 3; line += 1) {
      const r = rows.length + 1;
      const cells: Cell[] = Array.from({ length: 10 }, () => null);
      cells[0] = { v: lines[0][line], s: sheetStyle.sign };
      cells[5] = { v: lines[1][line], s: sheetStyle.sign };
      rows.push(cells);
      merges.push(`A${r}:E${r}`, `F${r}:J${r}`);
      heights[r] = 22;
    }
    rows.push([]);
  }
}

function categorySheet(title: string, items: SheetItem[], meta: SheetMeta, used: Set<string>): SheetSpec {
  const rows: Cell[][] = [];
  const merges: string[] = [];
  const heights: Record<number, number> = {};
  const full = (value: string, s: CellStyle) => [{ v: value, s }, ...Array.from({ length: 9 }, () => ({ s }))];
  const addFull = (value: string, s: CellStyle, height?: number) => {
    rows.push(full(value, s));
    merges.push(`A${rows.length}:${LAST_COL}${rows.length}`);
    if (height) heights[rows.length] = height;
  };
  addFull(meta.roundName, style.title, 24);
  addFull(meta.facilityName + (meta.districtName && !meta.facilityName.includes(meta.districtName) ? ` อำเภอ${meta.districtName}` : ""), style.subtitle, 20);
  addFull(meta.workGroupName || "ทุกกลุ่มงาน", style.subtitle, 20);
  if (meta.filterLabel) addFull(`เงื่อนไข: ${meta.filterLabel}`, style.note);
  rows.push([]);
  addFull(title, style.band, 22);
  rows.push(SHEET_HEADERS.map((label) => ({ v: label, s: style.header })));
  const headerRow = rows.length;
  heights[headerRow] = 34;

  const data = sheetRows(items);
  for (const row of data) {
    const r = rows.length + 1;
    rows.push([
      { v: row.order, s: style.center },
      { v: row.acquired, s: style.center },
      { v: row.assetCode, s: style.text },
      { v: row.accountingCode, s: style.center },
      { v: row.name, s: style.wrapText },
      { v: row.quantity, s: style.center },
      { v: row.unitValue, s: style.money },
      row.unitValue === null ? { s: style.money } : { f: `F${r}*G${r}`, v: row.unitValue, s: style.money },
      { v: row.location, s: style.small },
      { v: row.status, s: style.center },
    ]);
  }
  const first = headerRow + 1;
  const last = rows.length;
  const total = data.reduce((sum, row) => sum + (row.unitValue ?? 0), 0);
  rows.push([
    { v: "รวม", s: style.totalLabel }, { s: style.totalLabel }, { s: style.totalLabel }, { s: style.totalLabel }, { s: style.totalLabel },
    data.length ? { f: `SUM(F${first}:F${last})`, v: data.length, s: style.totalCount } : { v: 0, s: style.totalCount },
    { s: style.totalMoney },
    data.length ? { f: `SUM(H${first}:H${last})`, v: Math.round(total * 100) / 100, s: style.totalMoney } : { v: 0, s: style.totalMoney },
    { s: style.totalLabel }, { s: style.totalLabel },
  ]);
  merges.push(`A${rows.length}:E${rows.length}`);

  rows.push([], []);
  appendSignatures(rows, merges, heights, meta.committee);

  return {
    name: safeSheetName(title, used),
    rows,
    cols: COLS,
    rowHeights: heights,
    merges,
    autoFilter: `A${headerRow}:${LAST_COL}${Math.max(last, headerRow)}`,
    freezeRows: headerRow,
    printTitleRows: [headerRow - 1, headerRow],
    landscape: true,
    footer: "&Cหน้า &P / &N",
  };
}

/** One sheet per asset category (as in the paper form), each with the committee signature block. */
export function buildInspectionWorkbook(items: SheetItem[], meta: SheetMeta) {
  const used = new Set<string>();
  const groups = new Map<string, { label: string; items: SheetItem[] }>();
  for (const item of items) {
    const category = itemCategory(item);
    const group = groups.get(category.key) ?? { label: category.label, items: [] };
    group.items.push(item);
    groups.set(category.key, group);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "unclassified" ? 1 : b === "unclassified" ? -1 : Number(a) - Number(b)));
  const sheets = ordered.length
    ? ordered.map(([, group]) => categorySheet(group.label, group.items, meta, used))
    : [categorySheet("ไม่มีรายการตามเงื่อนไข", [], meta, used)];
  return { buffer: writeWorkbook(sheets), rowCount: items.length, sheetNames: sheets.map((sheet) => sheet.name) };
}
