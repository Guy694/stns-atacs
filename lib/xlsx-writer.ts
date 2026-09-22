import { deflateRawSync } from "node:zlib";

/**
 * Minimal styled .xlsx writer (Office Open XML) for printable forms.
 * The bundled SheetJS community build cannot write cell styles, so this writes the parts directly:
 * inline strings, numbers, formulas, fonts/fills/borders/alignment/number formats, merges, column
 * widths, row heights, frozen header, auto-filter, print titles and A4 landscape fit-to-width.
 */
export type CellStyle = {
  bold?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  border?: boolean;
  h?: "left" | "center" | "right";
  v?: "top" | "center" | "bottom";
  wrap?: boolean;
  numFmt?: string;
};
export type Cell = { v?: string | number | null; f?: string; s?: CellStyle } | null;
export type SheetSpec = {
  name: string;
  rows: Cell[][];
  cols?: number[];
  rowHeights?: Record<number, number>;
  merges?: string[];
  autoFilter?: string;
  freezeRows?: number;
  printTitleRows?: [number, number];
  landscape?: boolean;
  footer?: string;
};

const FONT = "Tahoma";
const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // Strip characters that are illegal in XML 1.0.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

export function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

export function safeSheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i += 1) candidate = `${base.slice(0, 28)} ${i}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

class StyleRegistry {
  fonts = [`<font><sz val="10"/><name val="${FONT}"/><family val="2"/></font>`];
  fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  numFmts: string[] = [];
  xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private cache = new Map<string, number>();

  private index(list: string[], xml: string) {
    const found = list.indexOf(xml);
    if (found >= 0) return found;
    list.push(xml);
    return list.length - 1;
  }

  id(style?: CellStyle) {
    if (!style) return 0;
    const key = JSON.stringify(style);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const font = this.index(this.fonts, `<font>${style.bold ? "<b/>" : ""}<sz val="${style.size ?? 10}"/>${style.color ? `<color rgb="FF${style.color}"/>` : ""}<name val="${FONT}"/><family val="2"/></font>`);
    const fill = style.fill ? this.index(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const side = '<color rgb="FF000000"/>';
    const border = style.border ? this.index(this.borders, `<border><left style="thin">${side}</left><right style="thin">${side}</right><top style="thin">${side}</top><bottom style="thin">${side}</bottom><diagonal/></border>`) : 0;
    let numFmtId = 0;
    if (style.numFmt) {
      const existing = this.numFmts.findIndex((xml) => xml.includes(`formatCode="${esc(style.numFmt!)}"`));
      numFmtId = existing >= 0 ? 164 + existing : 164 + this.numFmts.push(`<numFmt numFmtId="${164 + this.numFmts.length}" formatCode="${esc(style.numFmt)}"/>`) - 1;
    }
    const align = style.h || style.v || style.wrap
      ? `<alignment${style.h ? ` horizontal="${style.h}"` : ""} vertical="${style.v ?? "center"}"${style.wrap ? ' wrapText="1"' : ""}/>`
      : "";
    this.xfs.push(`<xf numFmtId="${numFmtId}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ""} applyFont="1"${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`);
    const id = this.xfs.length - 1;
    this.cache.set(key, id);
    return id;
  }

  xml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.join("")}</numFmts>` : ""}<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts><fills count="${this.fills.length}">${this.fills.join("")}</fills><borders count="${this.borders.length}">${this.borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

function sheetXml(sheet: SheetSpec, styles: StyleRegistry) {
  const rowsXml = sheet.rows.map((row, r) => {
    const cells = row.map((cell, c) => {
      if (!cell) return "";
      const ref = `${columnName(c)}${r + 1}`;
      const s = styles.id(cell.s);
      const sAttr = s ? ` s="${s}"` : "";
      if (cell.f) return `<c r="${ref}"${sAttr}><f>${esc(cell.f)}</f>${typeof cell.v === "number" ? `<v>${cell.v}</v>` : ""}</c>`;
      if (typeof cell.v === "number" && Number.isFinite(cell.v)) return `<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`;
      if (cell.v === null || cell.v === undefined || cell.v === "") return `<c r="${ref}"${sAttr}/>`;
      return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(String(cell.v))}</t></is></c>`;
    }).join("");
    const height = sheet.rowHeights?.[r + 1];
    return `<row r="${r + 1}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells}</row>`;
  }).join("");
  const cols = sheet.cols?.length
    ? `<cols>${sheet.cols.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const freeze = sheet.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${freeze}<sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${rowsXml}</sheetData>${sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : ""}${sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : ""}<printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.45" bottom="0.55" header="0.25" footer="0.25"/><pageSetup paperSize="9" orientation="${sheet.landscape === false ? "portrait" : "landscape"}" fitToWidth="1" fitToHeight="0"/>${sheet.footer ? `<headerFooter><oddFooter>${esc(sheet.footer)}</oddFooter></headerFooter>` : ""}</worksheet>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; data: string }>) {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.data, "utf8");
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, name, compressed);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(8, 10);
    header.writeUInt32LE(0, 12); header.writeUInt32LE(crc, 16); header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(name.length, 28); header.writeUInt16LE(0, 30); header.writeUInt16LE(0, 32); header.writeUInt16LE(0, 34); header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38); header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuffer, end]);
}

export function writeWorkbook(sheets: SheetSpec[]): Buffer {
  if (!sheets.length) throw new Error("Workbook needs at least one sheet");
  const styles = new StyleRegistry();
  const sheetFiles = sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet, styles) }));
  const quote = (name: string) => `'${name.replace(/'/g, "''")}'`;
  const definedNames = sheets.flatMap((sheet, index) => [
    sheet.autoFilter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${esc(quote(sheet.name))}!${sheet.autoFilter.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")}</definedName>` : "",
    sheet.printTitleRows ? `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${esc(quote(sheet.name))}!$${sheet.printTitleRows[0]}:$${sheet.printTitleRows[1]}</definedName>` : "",
  ]).join("");
  return zip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${esc(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    ...sheetFiles,
    { name: "xl/styles.xml", data: styles.xml() },
  ]);
}
