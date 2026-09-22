import { assetStatusLabel } from "@/lib/asset-status";
import {
  appendSignatures,
  itemCategory,
  itemLocation,
  sheetStyle as style,
  thaiDate,
  type SheetItem,
  type SheetMeta,
} from "@/lib/inspection-sheet";
import { safeSheetName, writeWorkbook, type Cell, type CellStyle } from "@/lib/xlsx-writer";

/**
 * Annual inspection result (รายงานผลการตรวจสอบพัสดุประจำปี): counts and value by category and outcome,
 * plus the items the committee should put forward for disposal or loss (broken, deteriorated/unused, not found).
 */
export type ReportItem = SheetItem & { inspectionAssetStatus?: string; conditionNote?: string; checkedAt?: string };
export type Outcome = "usable" | "broken" | "unused" | "missing" | "pending";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  usable: "ใช้งานได้",
  broken: "ชำรุด",
  unused: "เสื่อมสภาพ / ไม่ใช้งาน",
  missing: "ไม่พบ / สูญหาย",
  pending: "ยังไม่ได้ตรวจ",
};
export const OUTCOMES = Object.keys(OUTCOME_LABELS) as Outcome[];

export function itemOutcome(item: ReportItem): Outcome {
  if (item.inspectionStatus === "Missing") return "missing";
  if (item.inspectionStatus !== "Found") return "pending";
  const status = item.inspectionAssetStatus || item.currentStatus;
  if (status === "Broken") return "broken";
  if (status === "Inactive") return "unused";
  return "usable";
}

type Counts = Record<Outcome, number>;
const emptyCounts = (): Counts => ({ usable: 0, broken: 0, unused: 0, missing: 0, pending: 0 });
export type ReportRow = { key: string; label: string; total: number; value: number; counts: Counts };

export function summarizeInspection(items: ReportItem[]) {
  const map = new Map<string, ReportRow>();
  const totals: ReportRow = { key: "total", label: "รวม", total: 0, value: 0, counts: emptyCounts() };
  for (const item of items) {
    const category = itemCategory(item);
    const row = map.get(category.key) ?? { key: category.key, label: category.label, total: 0, value: 0, counts: emptyCounts() };
    const outcome = itemOutcome(item);
    for (const target of [row, totals]) {
      target.total += 1;
      target.value += item.purchasePrice ?? 0;
      target.counts[outcome] += 1;
    }
    map.set(category.key, row);
  }
  const rows = [...map.values()].sort((a, b) => (a.key === "unclassified" ? 1 : b.key === "unclassified" ? -1 : Number(a.key) - Number(b.key)));
  const round = (value: number) => Math.round(value * 100) / 100;
  // Items the committee reports for disposal (broken/unused) or loss investigation (missing).
  const proposed = items
    .filter((item) => ["broken", "unused", "missing"].includes(itemOutcome(item)))
    .sort((a, b) => itemCategory(a).label.localeCompare(itemCategory(b).label, "th") || (a.assetNumber || a.assetRegistrationNo).localeCompare(b.assetNumber || b.assetRegistrationNo, "th", { numeric: true }));
  return {
    rows: rows.map((row) => ({ ...row, value: round(row.value) })),
    totals: { ...totals, value: round(totals.value) },
    proposed,
  };
}

export type ReportMeta = SheetMeta & { startDate: string; endDate: string; closedAt: string; roundStatus: "Open" | "Closed" };

export function buildInspectionReportWorkbook(items: ReportItem[], meta: ReportMeta) {
  const summary = summarizeInspection(items);
  const used = new Set<string>();

  // ── Sheet 1: summary + findings + signatures ──
  const rows: Cell[][] = [];
  const merges: string[] = [];
  const heights: Record<number, number> = {};
  const full = (value: string, s: CellStyle, height?: number) => {
    rows.push([{ v: value, s }, ...Array.from({ length: 9 }, () => ({ s }))]);
    merges.push(`A${rows.length}:J${rows.length}`);
    if (height) heights[rows.length] = height;
  };
  const para = (value: string, height = 20) => {
    rows.push([{ v: value, s: { size: 11, wrap: true, v: "top" as const } }]);
    merges.push(`A${rows.length}:J${rows.length}`);
    heights[rows.length] = height;
  };
  full(`รายงานผลการตรวจสอบพัสดุ ${meta.roundName}`, style.title, 24);
  full(meta.facilityName + (meta.districtName && !meta.facilityName.includes(meta.districtName) ? ` อำเภอ${meta.districtName}` : ""), style.subtitle, 20);
  full(meta.workGroupName || "ทุกกลุ่มงาน", style.subtitle, 20);
  if (meta.roundStatus !== "Closed") full("ฉบับร่าง — รอบตรวจนับยังไม่ปิด ตัวเลขอาจเปลี่ยนแปลง", { ...style.note, color: "C00000" });
  rows.push([]);
  const period = [thaiDate(meta.startDate), thaiDate(meta.endDate)].filter(Boolean).join(" ถึง ");
  para(`คณะกรรมการตรวจสอบพัสดุได้ดำเนินการตรวจสอบพัสดุ${period ? ` ระหว่างวันที่ ${period}` : ""} จำนวนทั้งสิ้น ${summary.totals.total.toLocaleString("th-TH")} รายการ มูลค่ารวม ${summary.totals.value.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท ผลการตรวจสอบปรากฏดังนี้`, 36);
  rows.push([]);

  const header = ["ประเภทครุภัณฑ์", "", "จำนวน (รายการ)", "มูลค่าการได้มา (บาท)", ...OUTCOMES.map((o) => OUTCOME_LABELS[o]), ""];
  rows.push(header.map((v) => ({ v, s: style.header })));
  merges.push(`A${rows.length}:B${rows.length}`, `I${rows.length}:J${rows.length}`);
  heights[rows.length] = 34;
  // columns: A-B label | C total | D value | E usable | F broken | G unused | H missing | I-J pending
  const line = (row: ReportRow, bold = false) => {
    const text = bold ? style.totalLabel : style.text;
    const num = bold ? style.totalCount : style.center;
    rows.push([
      { v: row.label, s: bold ? { ...style.totalLabel, h: "center" } : text }, { s: text },
      { v: row.total, s: num }, { v: row.value, s: bold ? style.totalMoney : style.money },
      ...OUTCOMES.slice(0, 4).map((o) => ({ v: row.counts[o], s: num })),
      { v: row.counts.pending, s: num }, { s: num },
    ]);
    merges.push(`A${rows.length}:B${rows.length}`, `I${rows.length}:J${rows.length}`);
  };
  summary.rows.forEach((row) => line(row));
  line(summary.totals, true);
  rows.push([]);

  const c = summary.totals.counts;
  para("ข้อสังเกตและข้อเสนอของคณะกรรมการ", 20);
  para(`1. พัสดุอยู่ในสภาพใช้งานได้ ${c.usable.toLocaleString("th-TH")} รายการ`);
  para(`2. พัสดุชำรุด ${c.broken.toLocaleString("th-TH")} รายการ และเสื่อมสภาพหรือไม่จำเป็นต้องใช้ในหน่วยงาน ${c.unused.toLocaleString("th-TH")} รายการ เห็นควรพิจารณาดำเนินการจำหน่ายตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560`, 36);
  para(`3. พัสดุที่ตรวจไม่พบ ${c.missing.toLocaleString("th-TH")} รายการ เห็นควรพิจารณาแต่งตั้งคณะกรรมการสอบหาข้อเท็จจริงก่อนดำเนินการตามระเบียบ`, 36);
  if (c.pending) para(`4. พัสดุที่ยังไม่ได้ตรวจสอบ ${c.pending.toLocaleString("th-TH")} รายการ`);
  para("รายละเอียดรายการที่เสนอให้พิจารณาอยู่ในแผ่นงาน “รายการชำรุด-ไม่พบ”", 20);
  rows.push([], []);
  appendSignatures(rows, merges, heights, meta.committee);

  const summarySheet = {
    name: safeSheetName("สรุปผลการตรวจสอบ", used),
    rows, merges, rowHeights: heights,
    cols: [16, 22, 12, 16, 12, 12, 14, 14, 10, 6],
    landscape: false,
    footer: "&Cหน้า &P / &N",
  };

  // ── Sheet 2: items proposed for disposal / loss ──
  const drows: Cell[][] = [];
  const dmerges: string[] = [];
  const dheights: Record<number, number> = {};
  const dfull = (value: string, s: CellStyle, height?: number) => {
    drows.push([{ v: value, s }, ...Array.from({ length: 9 }, () => ({ s }))]);
    dmerges.push(`A${drows.length}:J${drows.length}`);
    if (height) dheights[drows.length] = height;
  };
  dfull(`รายการพัสดุที่ชำรุด เสื่อมสภาพ หรือตรวจไม่พบ — ${meta.roundName}`, style.title, 24);
  dfull(meta.facilityName + (meta.workGroupName ? ` · ${meta.workGroupName}` : ""), style.subtitle, 20);
  drows.push([]);
  const dHeader = ["ลำดับที่", "วัน เดือน ปี ที่ได้มา", "เลขครุภัณฑ์", "ประเภท", "รายการ", "มูลค่าการได้มา", "ผลการตรวจ", "สถานะในทะเบียน", "ใช้ประจำที่ไหน", "หมายเหตุ"];
  drows.push(dHeader.map((v) => ({ v, s: style.header })));
  const headerRow = drows.length;
  dheights[headerRow] = 34;
  summary.proposed.forEach((item, index) => {
    drows.push([
      { v: index + 1, s: style.center },
      { v: thaiDate(item.purchaseDate || item.installedAt), s: style.center },
      { v: item.assetNumber || item.assetRegistrationNo, s: style.text },
      { v: itemCategory(item).label, s: style.small },
      { v: item.assetName, s: style.wrapText },
      { v: item.purchasePrice, s: style.money },
      { v: OUTCOME_LABELS[itemOutcome(item)], s: style.center },
      { v: assetStatusLabel(item.currentStatus), s: style.center },
      { v: itemLocation(item), s: style.small },
      { v: item.conditionNote ?? "", s: style.small },
    ]);
  });
  if (!summary.proposed.length) {
    drows.push([{ v: "ไม่มีรายการชำรุด เสื่อมสภาพ หรือตรวจไม่พบ", s: style.center }, ...Array.from({ length: 9 }, () => ({ s: style.center }))]);
    dmerges.push(`A${drows.length}:J${drows.length}`);
  }
  drows.push([], []);
  appendSignatures(drows, dmerges, dheights, meta.committee);

  const detailSheet = {
    name: safeSheetName("รายการชำรุด-ไม่พบ", used),
    rows: drows, merges: dmerges, rowHeights: dheights,
    cols: [7, 13, 28, 18, 40, 14, 14, 14, 22, 24],
    autoFilter: `A${headerRow}:J${Math.max(headerRow, headerRow + summary.proposed.length)}`,
    freezeRows: headerRow,
    printTitleRows: [headerRow, headerRow] as [number, number],
    landscape: true,
    footer: "&Cหน้า &P / &N",
  };

  return { buffer: writeWorkbook([summarySheet, detailSheet]), summary };
}
