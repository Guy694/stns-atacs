import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { buildValuationSheet, filterValuationAssets } = loadTs("lib/valuation-sheet.ts");

const computer = (id, facilityId, overrides = {}) => ({
  id, assetName: `PC ${id}`, assetClass: "IT", assetCategory: "Hardware", deviceType: "คอมพิวเตอร์",
  subtypeName: "เครื่องคอมพิวเตอร์", purchasePrice: 30000, purchaseDate: "2022-10-01",
  currentStatus: "Active", facilityId, facilityName: `หน่วย ${facilityId}`, ...overrides,
});

test("กรองตามประเภทและหน่วยงาน", () => {
  const assets = [computer(1, 1), computer(2, 2), computer(3, 1, { assetClass: "Office" })];
  assert.equal(filterValuationAssets(assets, {}).length, 3);
  assert.equal(filterValuationAssets(assets, { facilityId: 1 }).length, 2);
  assert.equal(filterValuationAssets(assets, { assetClass: "IT", facilityId: 1 }).length, 1);
});

test("ยอดรวมแยกหน่วยงานรวมกันเท่ากับยอดรวมทั้งหมด", () => {
  const assets = [computer(1, 1), computer(2, 2), computer(3, 2)];
  const { report, byFacility } = buildValuationSheet(assets, 2567, "2026-09-29");
  assert.equal(byFacility.length, 2);
  const sum = byFacility.reduce((acc, row) => acc + row.totals.bookValue, 0);
  assert.equal(Math.round(sum * 100), Math.round(report.totals.bookValue * 100));
  assert.equal(report.totals.count, 3);
});
