import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const v = loadTs("lib/asset-valuation.ts");
const rollup = loadTs("lib/depreciation-rollup.ts");
const pc = { assetClass: "IT", assetCategory: "Hardware", purchasePrice: 30001, purchaseDate: "2023-10-01", facilityId: 1, facilityName: "A" };

test("an asset disposed after the period is still in that period's figures", () => {
  // FY2568 ends 2025-09-30; disposal approved in FY2570.
  const later = { ...pc, currentStatus: "Disposed", disposedOn: "2026-12-01" };
  const report = v.summarizeValuation([later], 2568, "2027-01-01");
  assert.equal(report.terminalCount, 0);
  assert.equal(report.totals.count, 1);
  const r = rollup.buildDepreciationRollup([later], 2568);
  assert.equal(r.totals.count, 1);
  assert.equal(r.excludedTerminal, 0);
});

test("an asset disposed on or before the period end, or with no known date, is excluded as before", () => {
  for (const disposedOn of ["2025-09-30", "2024-05-01", null, undefined]) {
    const asset = { ...pc, currentStatus: "Lost", disposedOn };
    assert.equal(v.summarizeValuation([asset], 2568, "2027-01-01").terminalCount, 1, String(disposedOn));
    assert.equal(rollup.buildDepreciationRollup([asset], 2568).excludedTerminal, 1, String(disposedOn));
  }
});

test("last year's closing balance equals this year's opening balance even after a later disposal", () => {
  const asset = { ...pc, currentStatus: "Disposed", disposedOn: "2026-12-01" }; // disposed in FY2570
  const fy2568 = rollup.buildDepreciationRollup([asset], 2568);
  const fy2569 = rollup.buildDepreciationRollup([asset], 2569);
  assert.ok(fy2568.totals.closingAccumulated > 0);
  assert.equal(fy2569.totals.openingAccumulated, fy2568.totals.closingAccumulated);
});

test("disposal dates: execution date first, approval date otherwise, latest approval per asset", async () => {
  const lib = loadTs("lib/asset-disposal-dates.ts", {
    "@/lib/mysql": { selectRows: async () => [{ asset_id: 7, disposed_on: new Date(2026, 2, 1) }, { asset_id: 8, disposed_on: "2025-01-02" }] },
  });
  const out = await lib.attachDisposalDates([{ id: 7, currentStatus: "Disposed" }, { id: 8, currentStatus: "Lost" }, { id: 9, currentStatus: "Active" }]);
  assert.deepEqual(out.map((a) => a.disposedOn ?? null), ["2026-03-01", "2025-01-02", null]);
});
