import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts.mjs";

const { dashboardCategoryId, summarizeDepreciationCategories, DEPRECIATION_CATEGORIES } = loadTs("lib/asset-depreciation.ts");
const plain = value => JSON.parse(JSON.stringify(value));

test("all 20 reference categories retain the source's rates, including exceptions", () => {
  assert.deepEqual(plain(DEPRECIATION_CATEGORIES.map(row => row.id)), Array.from({ length: 20 }, (_, i) => i + 1));
  const rates = id => DEPRECIATION_CATEGORIES.find(row => row.id === id).rates;
  assert.equal(rates(12)[0].years, 3);
  assert.equal(rates(12)[0].rate, 33);
  assert.deepEqual(plain(rates(5).map(row => [row.years, row.rate])), [[5, 20], [15, 6.5]]);
  assert.deepEqual(plain(rates(3).map(row => [row.years, row.rate])), [[3, 33], [12, 8]]);
  assert.deepEqual(plain(rates(2).map(row => [row.years, row.rate])), [[10, 10], [15, 6.5], [5, 20], [null, null], [5, 20], [10, 10]]);
  for (const id of [7, 8, 9]) assert.deepEqual(plain(rates(id).map(row => [row.years, row.rate])), [[2, 50], [5, 20]]);
});

test("legacy IT and recorded non-IT types use the same categories on both dashboards", () => {
  for (const assetClass of [undefined, "IT", " IT "]) {
    assert.equal(dashboardCategoryId({ assetClass, assetGroup: "Hardware", deviceType: " Desktop " }), 12);
    assert.equal(dashboardCategoryId({ assetClass, assetGroup: "Software" }), 20);
    assert.equal(dashboardCategoryId({ assetClass, assetGroup: "Hardware", deviceType: "โปรเจกเตอร์" }), 12);
  }
  for (const [assetClass, expected] of [["Office", 3], ["Medical", 11], ["Vehicle", 4]]) {
    assert.equal(dashboardCategoryId({ assetClass, assetGroup: "Software", deviceType: "Desktop" }), expected, "ignore stale IT fields");
  }
  for (const row of DEPRECIATION_CATEGORIES) {
    assert.equal(dashboardCategoryId({ assetClass: "Other", subtypeName: row.label }), row.id);
    assert.equal(dashboardCategoryId({ assetClass: "Other", extensions: { Other: { subtypeName: row.label } } }), row.id);
  }
  assert.equal(dashboardCategoryId({ assetClass: "Utility", subtypeName: "เครื่องกำเนิดไฟฟ้า" }), 5);
});

test("ambiguous classes, unknown device types and inactive-class extensions stay under review", () => {
  for (const asset of [
    { assetClass: "Building" }, { assetClass: "Building", subtypeName: "อาคารสำนักงาน" },
    { assetClass: "Utility", subtypeName: "ระบบประปา" },
    { assetClass: "Typo", deviceType: "Desktop" },
    { assetClass: "Building", extensions: { Other: { subtypeName: "อาคารถาวร" } } },
    { assetClass: "Medical", subtypeName: "ครุภัณฑ์คอมพิวเตอร์" },
  ]) assert.equal(dashboardCategoryId(asset), null);
});

test("each asset is counted once and status subtotals reconcile across a mixed registry", () => {
  const assets = [
    { assetClass: "IT", assetGroup: "Hardware", deviceType: "Desktop", currentStatus: "Active" },
    { assetClass: "Office", currentStatus: "Broken" },
    { assetClass: "Medical", currentStatus: "Inactive" },
    { assetClass: "Building", currentStatus: "Active" },
    { assetClass: "Other", extensions: { Other: { subtypeName: "ครุภัณฑ์การศึกษา" } }, currentStatus: "Active" },
  ];
  const summary = summarizeDepreciationCategories(assets);
  assert.equal(summary.total, 5);
  assert.equal(summary.rows.reduce((sum, row) => sum + row.total, 0) + summary.unclassified.total, 5);
  assert.equal(summary.unclassified.active, 1);
  for (const row of [...summary.rows, summary.unclassified]) assert.equal(row.total, row.active + row.broken + row.inactive);
  assert.equal(summarizeDepreciationCategories(assets.slice(0, 1)).rows.find(row => row.id === 3).total, 0, "counts depend only on the scoped input");
});

test("empty and ambiguous summaries render with reference details and no invalid percentages", () => {
  const { AssetCategorySummary } = loadTs("app/_components/asset-category-summary.tsx");
  const empty = renderToStaticMarkup(createElement(AssetCategorySummary, summarizeDepreciationCategories([])));
  assert.match(empty, /ยังไม่มีทรัพย์สินตามตัวกรองนี้/);
  assert.match(empty, /ตามเกณฑ์ย่อย/);
  assert.match(empty, /15 ปี · 6.5% ต่อปี/);
  assert.doesNotMatch(empty, /NaN|Infinity/);
  const mixed = renderToStaticMarkup(createElement(AssetCategorySummary, summarizeDepreciationCategories([{ assetClass: "Building", currentStatus: "Active" }])));
  assert.match(mixed, /รอตรวจสอบประเภท 1 รายการ/);
  assert.match(mixed, /ยังระบุเกณฑ์ไม่ได้/);
});
