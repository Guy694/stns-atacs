import { assetStatusLabel } from "@/lib/asset-status";
import { sheetStyle as style, thaiDate } from "@/lib/inspection-sheet";
import {
  REPLACEMENT_PRIORITY_LABELS,
  REPLACEMENT_REASON_LABELS,
  type ReplacementAsset,
  type ReplacementCandidate,
  type ReplacementRules,
} from "@/lib/replacement-plan";
import { writeWorkbook, type Cell, type CellStyle } from "@/lib/xlsx-writer";

export type ReplacementReportAsset = ReplacementAsset & {
  assetNumber: string;
  assetName: string;
  facilityName: string;
  workGroupName?: string | null;
};

type Meta = { scopeLabel: string; fiscalYear: number; printedBy: string; rules: ReplacementRules };

const COLS = 13;
const LAST = "M";

/** แผนการจัดหาครุภัณฑ์ทดแทน (Excel) — attach to the next fiscal year's procurement plan. */
export function buildReplacementWorkbook<A extends ReplacementReportAsset>(items: ReplacementCandidate<A>[], meta: Meta) {
  const sheet: Cell[][] = [];
  const merges: string[] = [];
  const heights: Record<number, number> = {};
  const full = (value: string, s: CellStyle, height?: number) => {
    sheet.push([{ v: value, s }, ...Array.from({ length: COLS - 1 }, () => ({ s }))]);
    merges.push(`A${sheet.length}:${LAST}${sheet.length}`);
    if (height) heights[sheet.length] = height;
  };
  full(`แผนการจัดหาครุภัณฑ์ทดแทน ประจำปีงบประมาณ ${meta.fiscalYear}`, style.title, 24);
  full(meta.scopeLabel, style.subtitle, 20);
  full(
    `ข้อมูล ณ ${thaiDate(new Date().toISOString().slice(0, 10))} · ${items.length.toLocaleString("th-TH")} รายการ · เกณฑ์: ชำรุด, ตัดค่าเสื่อมครบ/เกินอายุการใช้งาน, ซ่อม ${meta.rules.repairCountMin} ครั้งขึ้นไปใน ${meta.rules.repairWindowYears} ปี, ค่าซ่อมสะสม ≥ ${Math.round(meta.rules.repairCostRatio * 100)}% ของราคาทุน`,
    style.note,
  );
  sheet.push([]);
  const headers = ["ลำดับ", "ความเร่งด่วน", "เลขครุภัณฑ์", "รายการ", "หน่วยงาน / กลุ่มงาน", "สถานะ", "วันที่ได้มา", "อายุ (ปี)", "ราคาทุน (บาท)", "มูลค่าสุทธิ (บาท)", "ซ่อม (ครั้ง / บาท)", "เหตุผล", "หมายเหตุ"];
  sheet.push(headers.map((v) => ({ v, s: style.header })));
  const headerRow = sheet.length;
  heights[headerRow] = 34;

  items.forEach((item, index) => {
    const r = sheet.length + 1;
    sheet.push([
      { v: index + 1, s: style.center },
      { v: REPLACEMENT_PRIORITY_LABELS[item.priority], s: style.small },
      { v: item.asset.assetNumber || "-", s: style.text },
      { v: item.asset.assetName, s: style.wrapText },
      { v: [item.asset.facilityName, item.asset.workGroupName].filter(Boolean).join("\n"), s: style.small },
      { v: assetStatusLabel(item.asset.currentStatus), s: style.center },
      { v: item.valuation.startDate ? thaiDate(item.valuation.startDate) : "-", s: style.center },
      { v: item.ageYears ?? "", s: style.center },
      { v: item.asset.purchasePrice ?? null, s: style.money },
      { v: item.valuation.bookValue ?? null, s: style.money },
      { v: item.repairs.totalCount ? `${item.repairs.totalCount} / ${item.repairs.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-", s: style.small },
      { v: item.reasons.map((reason) => REPLACEMENT_REASON_LABELS[reason]).join(", "), s: style.small },
      { v: item.pendingDisposal ? "มีคำขอจำหน่ายรออนุมัติ" : "", s: style.small },
    ]);
    heights[r] = 30;
  });

  const first = headerRow + 1;
  const last = sheet.length;
  const costTotal = items.reduce((total, item) => total + (item.asset.purchasePrice ?? 0), 0);
  const bookTotal = items.reduce((total, item) => total + (item.valuation.bookValue ?? 0), 0);
  const sumCell = (column: string, value: number) => (items.length ? { f: `SUM(${column}${first}:${column}${last})`, v: Math.round(value * 100) / 100, s: style.totalMoney } : { v: 0, s: style.totalMoney });
  sheet.push([
    { v: "รวม (ประมาณการจากราคาทุนเดิม)", s: style.totalLabel }, ...Array.from({ length: 7 }, () => ({ s: style.totalLabel })),
    sumCell("I", costTotal), sumCell("J", bookTotal), { s: style.text }, { s: style.text }, { s: style.text },
  ]);
  merges.push(`A${sheet.length}:H${sheet.length}`);

  sheet.push([], []);
  const signers = ["ผู้จัดทำ", "หัวหน้าเจ้าหน้าที่", "หัวหน้าหน่วยงาน"];
  const spans = [["A", "D"], ["E", "H"], ["I", "M"]];
  const starts = [0, 4, 8];
  for (const line of [0, 1, 2]) {
    const r = sheet.length + 1;
    const cells: Cell[] = Array.from({ length: COLS }, () => null);
    signers.forEach((label, index) => {
      cells[starts[index]] = { v: line === 0 ? "ลงชื่อ ........................................" : line === 1 ? "(........................................)" : label, s: style.sign };
    });
    sheet.push(cells);
    spans.forEach(([from, to]) => merges.push(`${from}${r}:${to}${r}`));
    heights[r] = 22;
  }

  return writeWorkbook([{
    name: "แผนทดแทน",
    rows: sheet,
    merges,
    rowHeights: heights,
    cols: [6, 14, 18, 26, 20, 9, 11, 7, 13, 13, 14, 22, 14],
    freezeRows: headerRow,
    printTitleRows: [headerRow, headerRow],
    landscape: true,
    footer: `พิมพ์โดย ${meta.printedBy}`,
  }]);
}
