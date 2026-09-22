import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { buildDashboardSummary, readDashboardFilters, acquisitionFiscalYear } = loadTs("lib/dashboard-summary.ts");
const asset = (id, extra) => ({ id, assetRegistrationNo: `R${id}`, assetName: `A${id}`, usageDescription: "-", assetClass: "IT", assetGroup: "Hardware", deviceType: "Desktop", operatingSystem: "", privateIp: "", locationDetail: "", currentStatus: "Active", ownerName: "", updatedBy: "", updatedAt: "", maintenanceEndDate: "-", manufacturerBrand: "", serialNumber: "", purchaseDate: "-", installedAt: "-", ...extra });
const survey = (facilityId, districtName, assets) => ({ facilityId, facilityName: `F${facilityId}`, districtName, surveyDate: "", personnelCount: 0, completionRate: 0, lastUpdatedBy: "", assets });
const surveys = [
  survey(1, "เมือง", [
    asset(1, { purchasePrice: 30000, purchaseDate: "2025-11-01" }),
    asset(2, { currentStatus: "Broken", purchasePrice: 20000, purchaseDate: "2025-03-01" }),
    asset(3, { assetClass: "Vehicle", purchasePrice: 900000, installedAt: "2025-12-01" }),
  ]),
  survey(2, "ละงู", [asset(4, { currentStatus: "Disposed" }), asset(5, { assetClass: "Office", purchasePrice: 5000, purchaseDate: "2024-05-05" })]),
];
const plain = value => JSON.parse(JSON.stringify(value));

test("filters are validated and unknown values fall back to all", () => {
  assert.deepEqual(plain(readDashboardFilters({ fy: "2569", facility: "x", category: "12", district: "ละงู" })), { fy: "2569", district: "ละงู", facility: "", category: "12" });
  const summary = buildDashboardSummary(surveys, { fy: "2400", district: "ไม่มี", facility: "999", category: "" }, "2026-09-22");
  assert.deepEqual(plain(summary.filters), { fy: "", district: "", facility: "", category: "" });
  assert.equal(summary.total, 5);
});

test("fiscal year uses the Oct–Sep Thai year of purchase date, falling back to installation date", () => {
  assert.equal(acquisitionFiscalYear({ purchaseDate: "2025-10-01", installedAt: "-" }), 2569);
  assert.equal(acquisitionFiscalYear({ purchaseDate: "-", installedAt: "2025-09-30" }), 2568);
  assert.equal(acquisitionFiscalYear({ purchaseDate: "-", installedAt: "-" }), null);
  const fy69 = buildDashboardSummary(surveys, { fy: "2569", district: "", facility: "", category: "" }, "2026-09-22");
  assert.deepEqual(plain(fy69.fiscalYearOptions), [2569, 2568, 2567]);
  assert.equal(fy69.total, 2);
  assert.equal(fy69.undated, 1, "records without a date are counted, not silently dropped");
  assert.equal(fy69.totalCost, 930000);
});

test("KPIs, status mix, category share and district comparison agree", () => {
  const all = buildDashboardSummary(surveys, { fy: "", district: "", facility: "", category: "" }, "2026-09-22");
  assert.equal(all.active, 3);
  assert.equal(all.priced, 4);
  assert.equal(all.totalCost, 955000);
  assert.equal(all.statuses.find(s => s.value === "Disposed").count, 1);
  assert.equal(all.statuses.reduce((sum, s) => sum + s.count, 0), all.total);
  assert.deepEqual(plain(all.categories.map(c => [c.key, c.count])), [["12", 3], ["4", 1], ["3", 1]]);
  assert.deepEqual(plain(all.districts.map(d => [d.district, d.total, d.cost])), [["เมือง", 3, 950000], ["ละงู", 2, 5000]]);
  const muang = all.districts.find(d => d.district === "เมือง");
  assert.deepEqual(plain(muang.facilityRows.map(f => [f.id, f.total, f.cost])), [[1, 3, 950000]]);
  assert.equal(muang.facilityRows.reduce((sum, f) => sum + f.total, 0), muang.total, "facility rows add up to the district");
  const district = buildDashboardSummary(surveys, { fy: "", district: "ละงู", facility: "", category: "" }, "2026-09-22");
  assert.deepEqual(plain(district.facilityOptions.map(f => f.id)), [2]);
  assert.equal(district.total, 2);
  assert.equal(district.districts.length, 2, "district comparison keeps every district for context");
  assert.equal(district.districtCount, 1);
  const vehicles = buildDashboardSummary(surveys, { fy: "", district: "", facility: "", category: "4" }, "2026-09-22");
  assert.equal(vehicles.total, 1);
});
