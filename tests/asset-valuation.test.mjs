import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const v = loadTs("lib/asset-valuation.ts");
const plain = value => JSON.parse(JSON.stringify(value));
const computer = { assetClass: "IT", assetCategory: "Hardware", purchasePrice: 30001, purchaseDate: "2023-10-01" };

test("fiscal year follows the Thai government October–September year in B.E.", () => {
  assert.equal(v.fiscalYearOf("2026-09-30"), 2569);
  assert.equal(v.fiscalYearOf("2026-10-01"), 2570);
  assert.deepEqual(plain(v.fiscalYearRange(2570)), { start: "2026-10-01", end: "2027-09-30" });
});

test("straight-line depreciation charges full years evenly, prorates by day and stops at 1 baht", () => {
  const schedule = v.depreciationSchedule(computer);
  assert.deepEqual(plain(schedule.map(row => row.fiscalYear)), [2567, 2568, 2569]);
  assert.deepEqual(plain(schedule.map(row => row.depreciation)), [10000, 10000, 10000]);
  const midYear = v.depreciationSchedule({ ...computer, purchaseDate: "2024-01-15" });
  assert.deepEqual(plain(midYear.map(row => row.fiscalYear)), [2567, 2568, 2569, 2570]);
  assert.equal(midYear[0].depreciation, Math.round(10000 * 260 / 366 * 100) / 100, "first year prorated by days held");
  assert.equal(midYear[1].depreciation, 10000);
  assert.equal(midYear.at(-1).bookValue, 1);
  assert.equal(v.valueAsset({ ...computer, purchaseDate: "2024-01-15" }, "2030-01-01").fullyDepreciatedOn, "2027-01-14");
  assert.equal(schedule.at(-1).accumulated, 30000);
  assert.equal(schedule.at(-1).bookValue, 1);
  assert.equal(Math.round(schedule.reduce((sum, row) => sum + row.depreciation, 0) * 100) / 100, 30000);
  const mid = v.valueAsset(computer, "2025-03-31");
  assert.equal(mid.status, "ok");
  assert.equal(mid.life.years, 3);
  assert.ok(mid.bookValue > 1 && mid.bookValue < 30001);
  assert.equal(mid.isFullyDepreciated, false);
  const after = v.valueAsset(computer, "2030-01-01");
  assert.equal(after.bookValue, 1);
  assert.equal(after.isFullyDepreciated, true);
  assert.equal(after.fullyDepreciatedOn, "2026-09-30");
  assert.equal(v.depreciationForFiscalYear(computer, 2568), schedule[1].depreciation);
  assert.equal(v.depreciationForFiscalYear(computer, 2571), 0);
});

test("useful life uses the per-asset override, then the recorded subtype, then the class default", () => {
  assert.equal(v.resolveUsefulLife({ ...computer, usefulLifeYears: 7 }).years, 7);
  assert.equal(v.resolveUsefulLife({ ...computer, usefulLifeYears: 7 }).source, "override");
  assert.equal(v.resolveUsefulLife({ assetClass: "Electrical", subtypeName: "เครื่องกำเนิดไฟฟ้า" }).years, 15);
  assert.equal(v.resolveUsefulLife({ assetClass: "Electrical" }).years, 5);
  assert.equal(v.resolveUsefulLife({ assetClass: "Factory", subtypeName: "เครื่องจักรกล" }).years, 5);
  assert.equal(v.resolveUsefulLife({ assetClass: "Structure", subtypeName: "งานปรับปรุง: ไม้/ไม้อัด" }).years, 5);
  const extension = v.resolveUsefulLife({ assetClass: "Structure", subtypeName: "งานต่อเติม" });
  assert.equal(extension.years, null, "committee-decided items need an explicit life");
  assert.equal(v.valueAsset({ assetClass: "Structure", subtypeName: "งานต่อเติม", purchasePrice: 500000, purchaseDate: "2024-01-01" }, "2025-01-01").status, "no-life");
  assert.equal(v.resolveUsefulLife({ assetClass: "IT", assetCategory: "Software" }).years, 3);
});

test("incomplete or low-value records are reported, not silently valued", () => {
  assert.equal(v.valueAsset({ assetClass: "Office", purchasePrice: 4500, purchaseDate: "2024-01-01" }, "2025-01-01").status, "below-threshold");
  assert.equal(v.valueAsset({ assetClass: "Office", purchaseDate: "2024-01-01" }, "2025-01-01").status, "missing-price");
  assert.equal(v.valueAsset({ assetClass: "Office", purchasePrice: 45000 }, "2025-01-01").status, "missing-date");
  const installed = v.valueAsset({ assetClass: "Office", purchasePrice: 45000, installedAt: "2024-01-01" }, "2025-01-01");
  assert.equal(installed.startDate, "2024-01-01", "installation date is the fallback acquisition date");
  assert.equal(v.valueAsset(computer, "2023-01-01").status, "future");
});

test("register valuation groups by schedule category and excludes disposed, lost and unvalued items", () => {
  const assets = [
    { ...computer, currentStatus: "Active" },
    { ...computer, currentStatus: "Broken" },
    { ...computer, currentStatus: "Disposed" },
    { assetClass: "Vehicle", purchasePrice: 900001, purchaseDate: "2024-10-01", currentStatus: "Active" },
    { assetClass: "Office", purchasePrice: 3000, purchaseDate: "2024-10-01", currentStatus: "Active" },
    { assetClass: "Office", purchasePrice: 30000, currentStatus: "Active" },
  ];
  const report = v.summarizeValuation(assets, 2568, "2026-01-01");
  assert.equal(report.asOf, "2025-09-30");
  assert.equal(report.terminalCount, 1);
  assert.equal(report.totals.count, 3);
  assert.deepEqual(plain(report.rows.map(row => [row.categoryId, row.count])), [[4, 1], [12, 2]]);
  assert.equal(report.excluded["below-threshold"], 1);
  assert.equal(report.excluded["missing-date"], 1);
  assert.equal(report.belowThresholdCost, 3000);
  const vehicle = report.rows.find(row => row.categoryId === 4);
  assert.equal(vehicle.depreciationThisYear, 180000);
  assert.equal(vehicle.bookValue, 720001);
  assert.equal(report.totals.cost, 30001 * 2 + 900001);
});
