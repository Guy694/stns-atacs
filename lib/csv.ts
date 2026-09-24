/**
 * ตัวช่วยสร้างไฟล์ CSV ที่ปลอดภัย
 *
 * SEC-12: ค่าที่ขึ้นต้นด้วย = + - @ แท็บ หรือ CR จะถูก Excel/LibreOffice ตีความเป็นสูตร
 * เช่นชื่อครุภัณฑ์ `=HYPERLINK("http://...","คลิก")` จะทำงานทันทีที่ผู้ดูแลเปิดไฟล์
 * จึงเติมเครื่องหมาย ' นำหน้าและครอบด้วยเครื่องหมายคำพูดเสมอ
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  if (text === "") return "";

  const needsQuotes = /[",\n\r]/.test(text);
  if (FORMULA_PREFIX.test(text.replace(/^[\s ]+/, "")) || FORMULA_PREFIX.test(text)) {
    return `"'${text.replace(/"/g, '""')}"`;
  }
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][], options: { bom?: boolean } = {}) {
  const body = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  return options.bom === false ? body : `﻿${body}`;
}
