import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const policy = loadTs("lib/asset-policy.ts");
const { parseAssetFields } = loadTs("lib/asset-input.ts");

test("legacy IT, explicit non-IT and unknown classes remain distinct", () => {
  assert.equal(policy.isItAsset({}), true);
  assert.equal(policy.isItAsset({ assetClass: "Office" }), false);
  assert.equal(policy.isItAsset({ assetClass: "Typo" }), false);
  assert.throws(() => policy.parseAssetClass("Typo"));
  assert.throws(() => policy.parseAssetClass(""));
  assert.equal(policy.parseAssetClass(undefined, "Medical"), "Medical");
  const { normalizeAssetClass, assetClassLabel } = loadTs("lib/asset-classes.ts");
  assert.equal(normalizeAssetClass("Typo"), "Typo");
  assert.equal(assetClassLabel("Typo"), "Typo");
});

test("IT license and Agent eligibility depend on class, category and device type", () => {
  const pc = { assetClass: "IT", assetCategory: "Hardware", deviceType: "คอมพิวเตอร์ตั้งโต๊ะ" };
  assert.equal(policy.requiresWindowsLicense(pc), true);
  assert.equal(policy.supportsAgentAsset(pc), true);
  assert.equal(policy.supportsAgentAsset({ ...pc, deviceType: "เซิร์ฟเวอร์" }), true);
  // Current Windows agent emits all of these values, including Tablet.
  for (const deviceType of ["Laptop", "Workstation", "Enterprise Server", "Tablet", "Desktop", "Computer"]) {
    assert.equal(policy.supportsAgentAsset({ ...pc, deviceType }), true);
  }
  for (const patch of [{ assetClass: "Medical" }, { assetCategory: "Software" }, { deviceType: "สวิตช์เครือข่าย" }]) {
    assert.equal(policy.requiresWindowsLicense({ ...pc, ...patch }), false);
    assert.equal(policy.supportsAgentAsset({ ...pc, ...patch }), false);
  }
  assert.throws(() => parseAssetFields({ assetName: "PC", deviceType: "Desktop" }), /windows_license_status/);
});

test("every non-IT class saves common fields without accepting IT-only updates", () => {
  for (const assetClass of ["Office", "Medical", "Vehicle", "Building", "Utility", "Other"]) {
    const input = parseAssetFields({ assetClass, assetName: "Example", assetCategory: "Software", deviceType: "Desktop", operatingSystem: "Windows", publicIp: "invalid", manufacturerModel: "Model" });
    assert.equal(input.assetClass, assetClass);
    assert.equal(input.assetCategory, "Hardware");
    assert.equal(input.manufacturerModel, "Model");
    for (const field of ["deviceType", "operatingSystem", "publicIp", "windowsLicenseStatus"]) assert.equal(Object.hasOwn(input, field), false);
  }
});

test("partial updates preserve omitted fields and explicit empty form values clear them", () => {
  const current = { assetName: "PC", assetClass: "IT", assetCategory: "Hardware", deviceType: "Desktop", windowsLicenseStatus: "Genuine", assetRegistrationNo: "IT-1", currentStatus: "Broken", purchaseDate: "2025-01-01", maintenanceStartDate: "2025-01-01", maintenanceEndDate: "2027-01-01" };
  const patch = parseAssetFields({ assetName: "Renamed" }, current);
  assert.equal(patch.assetRegistrationNo, "IT-1");
  for (const field of ["windowsLicenseStatus", "purchaseDate", "maintenanceStartDate", "maintenanceEndDate", "currentStatus", "deviceType"]) assert.equal(Object.hasOwn(patch, field), false);
  const cleared = parseAssetFields({ purchaseDate: "", purchasePrice: "", assetRegistrationNo: "", manufacturerModel: "" }, current);
  assert.equal(cleared.purchaseDate, "");
  assert.equal(cleared.purchasePrice, null);
  assert.equal(cleared.assetRegistrationNo, null);
  assert.equal(cleared.manufacturerModel, "");
  assert.throws(() => parseAssetFields({ maintenanceEndDate: "2024-01-01" }, current));
});

test("dates, statuses and prices are validated by the shared form/import policy", () => {
  for (const patch of [{ purchaseDate: "2025-02-30" }, { purchasePrice: "-1" }, { purchasePrice: "NaN" }, { currentStatus: "Typo" }, { assetClass: "Typo" }]) {
    assert.throws(() => parseAssetFields({ assetName: "Desk", ...patch }));
  }
});

test("mixed registries do not count non-IT compatibility Hardware as IT", () => {
  const assets = [{ assetGroup: "Hardware" }, { assetClass: "IT", assetGroup: "Software" }, ...["Office", "Medical", "Vehicle", "Building", "Utility", "Other"].map(assetClass => ({ assetClass, assetGroup: "Hardware", deviceType: "Desktop" }))];
  assert.deepEqual(JSON.parse(JSON.stringify(policy.summarizeAssetClasses(assets))), { hardware: 1, software: 1, nonIt: 6 });
  assert.equal(policy.assetTypeLabel(assets[2]), "สำนักงาน");
});
