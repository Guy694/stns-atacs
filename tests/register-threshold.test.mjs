import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { buildRegisterSheet } = loadTs("lib/register-sheet.ts");
const base = { id: 1, assetNumber: "A-1", assetName: "โต๊ะ", purchaseDate: "2024-01-15", vendorName: "x", fundingSource: "budget", acquisitionMethod: "buy" };

test("the register shows no depreciation schedule for items under 10,000 baht", () => {
  const sheet = buildRegisterSheet({ ...base, purchasePrice: 9500 }, 5, 20);
  assert.equal(sheet.rows.filter((row) => row.detail.startsWith("คำนวณค่าเสื่อมราคา")).length, 0);
  assert.match(sheet.startNote, /ต่ำกว่าเกณฑ์ 10,000 บาท ไม่คิดค่าเสื่อมราคา/);
  assert.equal(sheet.rows[0].bookValue, "9,500.00");
});

test("the register still schedules items of 10,000 baht or more", () => {
  const sheet = buildRegisterSheet({ ...base, purchasePrice: 10000 }, 5, 20);
  assert.ok(sheet.rows.some((row) => row.detail.startsWith("คำนวณค่าเสื่อมราคา")));
});
