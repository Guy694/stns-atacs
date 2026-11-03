import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import { loadTs } from "./helpers/load-ts.mjs";

const csv = loadTs("lib/csv-parse.ts");
const sheet = loadTs("lib/spreadsheet-parse.ts");
const cron = loadTs("lib/cron-auth.ts", {}, { process });

test("CSV: คงข้อความตามที่กรอก รองรับ BOM คำพูด จุลภาค และขึ้นบรรทัดในช่อง", () => {
  const text = '﻿asset_name,purchase_date,serial\r\n"Printer, A",2022-10-01,00123\r\n"line1\nline2","",""\r\n\r\n';
  const rows = csv.parseCsvObjects(text, 100);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].asset_name, "Printer, A");
  assert.equal(rows[0].purchase_date, "2022-10-01");
  assert.equal(rows[0].serial, "00123");
  assert.equal(rows[1].asset_name, "line1\nline2");
  assert.equal(csv.parseCsvRecords('a,"say ""hi"""\n')[0][1], 'say "hi"');
});

test("CSV: หัวตาราง __proto__ ไม่แก้ prototype และอ่านไม่เกินโควตา", () => {
  const rows = csv.parseCsvObjects("__proto__,asset_name\n{\"x\":1},A\n,B\n,C\n", 2);
  assert.equal(rows.length, 2);
  assert.equal(({}).x, undefined);
  assert.equal(Object.keys(rows[0]).join(), "asset_name");
});

test("Excel อ่านใน worker: วันที่เป็น YYYY-MM-DD และเลข 0 นำหน้าไม่หาย", async () => {
  const ws = XLSX.utils.aoa_to_sheet([["asset_name", "purchase_date", "serial"], ["Printer", new Date(Date.UTC(2022, 9, 1)), "00123"]], { cellDates: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, ws, "assets");
  const bytes = new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  const rows = await sheet.parseImportFile(bytes, "assets.xlsx", 100);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_name, "Printer");
  assert.equal(rows[0].purchase_date, "2022-10-01");
  assert.equal(rows[0].serial, "00123");
});

test("Excel ที่เสียหายถูกปฏิเสธโดยไม่ทำให้เซิร์ฟเวอร์ล้ม", async () => {
  await assert.rejects(() => sheet.parseImportFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "bad.xlsx", 10));
  await assert.rejects(() => sheet.parseImportFile(new Uint8Array([1]), "bad.txt", 10));
});

test("cron: ต้องมี CRON_SECRET และ header ตรงทุกตัวอักษร", () => {
  assert.equal(cron.isAuthorizedCronHeader("Bearer s3cret", "s3cret"), true);
  assert.equal(cron.isAuthorizedCronHeader("Bearer s3creT", "s3cret"), false);
  assert.equal(cron.isAuthorizedCronHeader("Bearer ", ""), false);
  assert.equal(cron.isAuthorizedCronHeader(null, "s3cret"), false);
  assert.equal(cron.isAuthorizedCronHeader("Bearer s3cret", undefined), false);
});
