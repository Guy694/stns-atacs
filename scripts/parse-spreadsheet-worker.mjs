// อ่านไฟล์ Excel (.xlsx / .xls) ใน worker thread แยกจากเซิร์ฟเวอร์หลัก
// SEC-11: xlsx 0.18.5 มีช่องโหว่ prototype pollution (CVE-2023-30533) และ ReDoS (CVE-2024-22363)
// การอ่านในเธรดแยกทำให้ prototype ที่ถูกแก้อยู่แค่ในเธรดนี้ และฝั่งหลักตัดเธรดทิ้งได้เมื่อเกินเวลา/หน่วยความจำ
import { parentPort, workerData } from "node:worker_threads";
import * as XLSX from "xlsx";

const { buffer, maxRows } = workerData;
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);

try {
  const workbook = XLSX.read(Buffer.from(buffer), {
    type: "buffer",
    codepage: 65001,
    raw: false,
    dateNF: "yyyy-mm-dd",
    sheetRows: maxRows + 2,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" }) : [];
  // ส่งกลับเฉพาะข้อความธรรมดา
  const plain = rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      const name = String(key).replace(/^﻿/, "").trim();
      if (!BLOCKED.has(name)) out[name] = value == null ? "" : String(value);
    }
    return out;
  });
  parentPort.postMessage({ ok: true, rows: plain });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
}
