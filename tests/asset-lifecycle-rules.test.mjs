import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { parseAssetFields } = loadTs("lib/asset-input.ts");
const repairOptions = loadTs("lib/repair-options.ts");
const office = { assetClass: "Office", assetName: "โต๊ะ" };

test("Disposed/Lost cannot be set or reverted through forms, imports or inspections", () => {
  assert.throws(() => parseAssetFields({ ...office, currentStatus: "Disposed" }), /คำขอจำหน่าย/);
  assert.throws(() => parseAssetFields({ ...office, currentStatus: "Lost" }, { ...office, assetCategory: "Hardware", currentStatus: "Active" }), /คำขอจำหน่าย/);
  const disposed = { ...office, assetCategory: "Hardware", currentStatus: "Disposed" };
  assert.throws(() => parseAssetFields({ ...office, currentStatus: "Active" }, disposed), /เปลี่ยนสถานะ/);
  // Re-submitting the same terminal status or omitting it keeps the approved status.
  assert.equal(parseAssetFields({ ...office, currentStatus: "Disposed" }, disposed).currentStatus, undefined);
  assert.equal(parseAssetFields({ ...office, ownerName: "x" }, disposed).currentStatus, undefined);
  assert.equal(parseAssetFields({ ...office, currentStatus: "Broken" }, { ...disposed, currentStatus: "Active" }).currentStatus, "Broken");
});

test("useful-life override is optional, validated, and omitted fields keep the stored value", () => {
  assert.equal(parseAssetFields({ ...office, usefulLifeYears: "12" }).usefulLifeYears, 12);
  assert.equal(parseAssetFields({ ...office, usefulLifeYears: "" }).usefulLifeYears, null);
  assert.equal("usefulLifeYears" in parseAssetFields({ ...office }), false);
  for (const bad of ["0", "1.5", "101", "abc"]) assert.throws(() => parseAssetFields({ ...office, usefulLifeYears: bad }), /อายุการใช้งาน/);
});

test("repair jobs follow the allowed status transitions", () => {
  assert.equal(repairOptions.canTransitionRepair("Reported", "InProgress"), true);
  assert.equal(repairOptions.canTransitionRepair("SentToVendor", "InProgress"), true);
  assert.equal(repairOptions.canTransitionRepair("InProgress", "Reported"), false);
  assert.equal(repairOptions.canTransitionRepair("Completed", "InProgress"), false);
  assert.equal(repairOptions.canTransitionRepair("Cancelled", "Cancelled"), false, "closed jobs cannot be edited");
  assert.equal(repairOptions.canTransitionRepair("InProgress", "InProgress"), true, "open jobs accept detail updates");
});
