import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const v = loadTs("lib/asset-valuation.ts");
const { buildRegisterSheet } = loadTs("lib/register-sheet.ts");

test("threshold: 5,000 baht for items acquired before FY2563 (1 Oct 2019), 10,000 baht from FY2563", () => {
  assert.equal(v.capitalizationThresholdFor("2019-09-30"), 5000);
  assert.equal(v.capitalizationThresholdFor("2019-10-01"), 10000);
  assert.equal(v.capitalizationThresholdFor("2015-01-01"), 5000);
  assert.equal(v.capitalizationThresholdFor(null), 10000);
});

test("an 8,000-baht item is depreciated if acquired in FY2562 but not if acquired in FY2563", () => {
  const office = { assetClass: "Office", purchasePrice: 8000 };
  assert.equal(v.valueAsset({ ...office, purchaseDate: "2019-09-30" }, "2020-09-30").status, "ok");
  assert.equal(v.valueAsset({ ...office, purchaseDate: "2019-10-01" }, "2020-09-30").status, "below-threshold");
  assert.equal(v.valueAsset({ ...office, purchasePrice: 4999, purchaseDate: "2018-01-01" }, "2020-09-30").status, "below-threshold");
});

test("the register applies the same dated threshold", () => {
  const base = { id: 1, assetNumber: "A-1", assetName: "โต๊ะ", purchasePrice: 8000 };
  const old = buildRegisterSheet({ ...base, purchaseDate: "2019-09-30" }, 5, 20);
  assert.ok(old.rows.some((row) => row.detail.startsWith("คำนวณค่าเสื่อมราคา")));
  const recent = buildRegisterSheet({ ...base, purchaseDate: "2019-10-01" }, 5, 20);
  assert.equal(recent.rows.filter((row) => row.detail.startsWith("คำนวณค่าเสื่อมราคา")).length, 0);
  assert.match(recent.startNote, /ต่ำกว่าเกณฑ์ 10,000 บาท/);
  assert.match(buildRegisterSheet({ ...base, purchasePrice: 4000, purchaseDate: "2018-01-01" }, 5, 20).startNote, /ต่ำกว่าเกณฑ์ 5,000 บาท/);
});
