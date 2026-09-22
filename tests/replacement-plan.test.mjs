import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const XLSX = createRequire(import.meta.url)("xlsx");
const plan = loadTs("lib/replacement-plan.ts", {}, { Math, Number, Object, Map, Set, Array });
const report = loadTs("lib/replacement-report.ts", {}, { URLSearchParams, Intl, Math, Number, String, Buffer, Array, Object });

const TODAY = "2026-09-22";
const asset = (id, extra = {}) => ({
  id, assetNumber: `สสจ.${id}`, assetName: `ครุภัณฑ์ ${id}`, facilityName: "สสจ.สตูล", workGroupName: "ไอที",
  assetClass: "IT", assetCategory: "Hardware", deviceType: "Computer", currentStatus: "Active",
  purchasePrice: 30000, purchaseDate: "2024-01-15", usefulLifeYears: 5, ...extra,
});

test("reasons, score and priority", () => {
  const none = plan.assessReplacement(asset(1), undefined, false, TODAY);
  assert.equal(none, null, "a young working asset is not a candidate");

  const old = plan.assessReplacement(asset(2, { purchaseDate: "2015-01-01" }), undefined, false, TODAY);
  assert.deepEqual([...old.reasons], ["fully-depreciated"]);
  assert.equal(old.priority, "Low");
  assert.ok(old.ageYears > 11);

  const brokenOld = plan.assessReplacement(asset(3, { currentStatus: "Broken", purchaseDate: "2015-01-01" }), { recentCount: 3, totalCount: 4, totalCost: 16000 }, true, TODAY);
  assert.deepEqual([...brokenOld.reasons], ["broken", "fully-depreciated", "frequent-repair", "repair-cost"]);
  assert.equal(brokenOld.score, 9);
  assert.equal(brokenOld.priority, "High");
  assert.equal(brokenOld.repairCostRatio, 0.533);
  assert.equal(brokenOld.pendingDisposal, true);

  // Below the capitalisation threshold there is no depreciation, but age still counts.
  const cheap = plan.assessReplacement(asset(4, { purchasePrice: 3000, purchaseDate: "2018-01-01" }), undefined, false, TODAY);
  assert.deepEqual([...cheap.reasons], ["over-age"]);

  assert.equal(plan.assessReplacement(asset(5, { currentStatus: "Disposed", purchaseDate: "2010-01-01" }), undefined, false, TODAY), null);
  assert.equal(plan.priorityOf(3), "Medium");
  assert.equal(plan.repairWindowStart("2028-02-29", 2), "2026-03-01");
});

test("plan ordering, counts and Excel output", () => {
  const assets = [
    asset(1),
    asset(2, { purchaseDate: "2015-01-01" }),
    asset(3, { currentStatus: "Broken", purchaseDate: "2015-01-01" }),
    asset(4, { currentStatus: "Broken" }),
  ];
  const result = plan.buildReplacementPlan(assets, new Map([[4, { recentCount: 3, totalCount: 3, totalCost: 1000 }]]), new Set(), TODAY);
  assert.deepEqual(result.items.map((item) => item.asset.id), [3, 4, 2]);
  assert.deepEqual({ ...result.counts }, { High: 2, Medium: 0, Low: 1 });
  assert.equal(result.estimatedBudget.High, 60000);
  assert.equal(result.reasonCounts.broken, 2);

  const buffer = report.buildReplacementWorkbook(result.items, { scopeLabel: "สสจ.สตูล", fiscalYear: 2570, printedBy: "ผู้ทดสอบ", rules: plan.DEFAULT_REPLACEMENT_RULES });
  const book = XLSX.read(buffer, { type: "buffer" });
  const text = XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]]);
  assert.match(text, /แผนการจัดหาครุภัณฑ์ทดแทน ประจำปีงบประมาณ 2570/);
  assert.match(text, /เร่งด่วน/);
  assert.match(text, /ชำรุด, ตัดค่าเสื่อมครบแล้ว/);
  assert.match(text, /ซ่อมบ่อย/);
  assert.match(text, /ลงชื่อ/);
});
