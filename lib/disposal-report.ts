import { thaiDate } from "@/lib/inspection-sheet";
import { sheetStyle as style } from "@/lib/inspection-sheet";
import { DISPOSAL_REQUEST_TYPE_LABELS, disposalMethodLabel } from "@/lib/disposal-options";
import { writeWorkbook, type Cell, type CellStyle } from "@/lib/xlsx-writer";

/**
 * Printable disposal documents (Excel):
 * - "pending": รายการพัสดุที่ขออนุมัติจำหน่าย — attach to the request memo for the approver.
 * - "annual":  รายงานการจำหน่ายพัสดุประจำปีงบประมาณ — approved disposals/write-offs with approval,
 *              execution evidence and money received.
 */
export type DisposalReportRow = {
  id: number;
  assetNumber: string;
  assetName: string;
  acquiredOn: string;
  requestType: "Disposed" | "Lost";
  disposalMethod: string | null;
  reason: string;
  purchasePrice: number | null;
  bookValue: number | null;
  requestedBy: string;
  requestedAt: string;
  decidedAt: string;
  approvalDocumentNo: string;
  executedOn: string;
  executionDocumentNo: string;
  proceedsAmount: number | null;
};

export type DisposalReportMeta = { kind: "pending" | "annual"; facilityName: string; fiscalYear?: number; printedBy: string };

const COLS = 10;
const LAST = "J";

const methodText = (row: DisposalReportRow) =>
  row.requestType === "Lost" ? "สูญหาย (จำหน่ายเป็นสูญ)" : `${DISPOSAL_REQUEST_TYPE_LABELS[row.requestType]} · ${disposalMethodLabel(row.disposalMethod)}`;

export function summarizeDisposals(rows: DisposalReportRow[]) {
  const sum = (pick: (row: DisposalReportRow) => number | null) => Math.round(rows.reduce((total, row) => total + (pick(row) ?? 0), 0) * 100) / 100;
  return {
    count: rows.length,
    disposed: rows.filter((row) => row.requestType === "Disposed").length,
    lost: rows.filter((row) => row.requestType === "Lost").length,
    cost: sum((row) => row.purchasePrice),
    bookValue: sum((row) => row.bookValue),
    proceeds: sum((row) => row.proceedsAmount),
    awaitingExecution: rows.filter((row) => row.requestType === "Disposed" && !row.executedOn).length,
  };
}

export function buildDisposalWorkbook(rows: DisposalReportRow[], meta: DisposalReportMeta) {
  const sheet: Cell[][] = [];
  const merges: string[] = [];
  const heights: Record<number, number> = {};
  const full = (value: string, s: CellStyle, height?: number) => {
    sheet.push([{ v: value, s }, ...Array.from({ length: COLS - 1 }, () => ({ s }))]);
    merges.push(`A${sheet.length}:${LAST}${sheet.length}`);
    if (height) heights[sheet.length] = height;
  };
  const pending = meta.kind === "pending";
  full(pending ? "รายการพัสดุที่ขออนุมัติจำหน่าย" : `รายงานการจำหน่ายพัสดุ ประจำปีงบประมาณ ${meta.fiscalYear ?? ""}`.trim(), style.title, 24);
  full(meta.facilityName, style.subtitle, 20);
  full(`ข้อมูล ณ ${thaiDate(new Date().toISOString().slice(0, 10))} · ${rows.length.toLocaleString("th-TH")} รายการ`, style.note);
  sheet.push([]);

  const headers = pending
    ? ["ลำดับ", "เลขครุภัณฑ์", "รายการ", "วันที่ได้มา", "ราคาทุน (บาท)", "มูลค่าสุทธิ (บาท)", "ประเภท / วิธีการ", "เหตุผล", "", "หมายเหตุ"]
    : ["ลำดับ", "เลขครุภัณฑ์", "รายการ", "ราคาทุน (บาท)", "มูลค่าสุทธิ (บาท)", "ประเภท / วิธีการ", "อนุมัติ (วันที่ / หนังสือ)", "ดำเนินการ (วันที่ / หลักฐาน)", "เงินที่ได้รับ (บาท)", "หมายเหตุ"];
  sheet.push(headers.map((v) => ({ v, s: style.header })));
  const headerRow = sheet.length;
  heights[headerRow] = 34;
  if (pending) merges.push(`H${headerRow}:I${headerRow}`);

  rows.forEach((row, index) => {
    const r = sheet.length + 1;
    if (pending) {
      sheet.push([
        { v: index + 1, s: style.center },
        { v: row.assetNumber, s: style.text },
        { v: row.assetName, s: style.wrapText },
        { v: thaiDate(row.acquiredOn), s: style.center },
        { v: row.purchasePrice, s: style.money },
        { v: row.bookValue, s: style.money },
        { v: methodText(row), s: style.small },
        { v: row.reason, s: style.small }, { s: style.small },
        { v: `คำขอ #${row.id} · ${row.requestedBy}`, s: style.small },
      ]);
      merges.push(`H${r}:I${r}`);
    } else {
      sheet.push([
        { v: index + 1, s: style.center },
        { v: row.assetNumber, s: style.text },
        { v: row.assetName, s: style.wrapText },
        { v: row.purchasePrice, s: style.money },
        { v: row.bookValue, s: style.money },
        { v: methodText(row), s: style.small },
        { v: [thaiDate(row.decidedAt.slice(0, 10)), row.approvalDocumentNo].filter(Boolean).join("\n"), s: style.small },
        { v: row.requestType === "Lost" ? "ตัดออกจากทะเบียน" : [thaiDate(row.executedOn), row.executionDocumentNo].filter(Boolean).join("\n") || "ยังไม่บันทึกผล", s: style.small },
        { v: row.proceedsAmount, s: style.money },
        { v: `คำขอ #${row.id}`, s: style.small },
      ]);
    }
    heights[r] = 30;
  });

  const totals = summarizeDisposals(rows);
  const first = headerRow + 1;
  const last = sheet.length;
  const sumCell = (column: string, value: number) => (rows.length ? { f: `SUM(${column}${first}:${column}${last})`, v: value, s: style.totalMoney } : { v: 0, s: style.totalMoney });
  const totalRow: Cell[] = pending
    ? [{ v: "รวม", s: style.totalLabel }, { s: style.totalLabel }, { s: style.totalLabel }, { s: style.totalLabel }, sumCell("E", totals.cost), sumCell("F", totals.bookValue), { s: style.text }, { s: style.text }, { s: style.text }, { s: style.text }]
    : [{ v: "รวม", s: style.totalLabel }, { s: style.totalLabel }, { s: style.totalLabel }, sumCell("D", totals.cost), sumCell("E", totals.bookValue), { s: style.text }, { s: style.text }, { s: style.text }, sumCell("I", totals.proceeds), { s: style.text }];
  sheet.push(totalRow);
  merges.push(pending ? `A${sheet.length}:D${sheet.length}` : `A${sheet.length}:C${sheet.length}`);

  sheet.push([], []);
  const signers = pending
    ? ["เจ้าหน้าที่ / ผู้เสนอ", "หัวหน้าเจ้าหน้าที่", "หัวหน้าหน่วยงาน (ผู้อนุมัติ)"]
    : ["ผู้จัดทำรายงาน", "หัวหน้าเจ้าหน้าที่", "หัวหน้าหน่วยงาน"];
  // Three signature blocks across A–C, D–G, H–J.
  const spans = [["A", "C"], ["D", "G"], ["H", "J"]];
  const starts = [0, 3, 7];
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

  const buffer = writeWorkbook([{
    name: pending ? "ขออนุมัติจำหน่าย" : "รายงานการจำหน่าย",
    rows: sheet,
    merges,
    rowHeights: heights,
    cols: pending ? [6, 20, 30, 12, 13, 13, 20, 24, 8, 16] : [6, 20, 28, 13, 13, 20, 18, 18, 13, 10],
    freezeRows: headerRow,
    printTitleRows: [headerRow, headerRow],
    landscape: true,
    footer: `พิมพ์โดย ${meta.printedBy}`,
  }]);
  return { buffer, totals };
}
