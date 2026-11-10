import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const pub = loadTs("lib/public-asset.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

const computer = {
  id: 350,
  assetName: "DESKTOP-J7K8VSS · TravelMate P214-52",
  assetRegistrationNo: "7440-001-0006/120",
  assetCodePrefix: "สสจ.",
  assetClass: "IT",
  assetCategory: "Hardware",
  deviceType: "Laptop",
  facilityName: "สสจ.สตูล",
  workGroupName: "กลุ่มงานสุขภาพดิจิทัล",
  manufacturerBrand: "Acer",
  manufacturerModel: "TravelMate P214-52",
  manufacturerSpecification: "Core i5, host DESKTOP-J7K8VSS 192.168.130.65",
  currentStatus: "Active",
  purchaseDate: "2021-03-15",
  purchasePrice: 23500,
  // everything below must never leave the server
  privateIp: "192.168.130.65",
  publicIp: "203.0.113.7",
  macAddress: "AA:BB:CC:DD:EE:FF",
  operatingSystem: "Windows 11 Pro",
  operatingSystemVersion: "23H2",
  windowsLicenseStatus: "Genuine",
  serialNumber: "NXVLFST01Z0390B71F7600",
  ownerName: "นายตัวอย่าง ทดสอบ",
  locationDetail: "ห้อง Server ชั้น 2",
  purchaseOrderNo: "PO-123",
  vendorName: "บริษัท ตัวอย่าง",
  updatedBy: "admin",
};
const valuation = { status: "ok", cost: 23500, bookValue: 9400.5, isFullyDepreciated: false };
const SECRETS = ["192.168.130.65", "203.0.113.7", "AA:BB:CC:DD:EE:FF", "DESKTOP-J7K8VSS", "Windows 11", "23H2", "Genuine", "NXVLFST01Z0390B71F7600", "นายตัวอย่าง", "ห้อง Server", "PO-123", "บริษัท ตัวอย่าง"];

test("public view contains only whitelisted fields — no network, machine, owner, serial or procurement data", () => {
  const view = plain(pub.toPublicAssetView(computer, valuation, "2026-11-09", { hostname: "DESKTOP-J7K8VSS" }));
  const text = JSON.stringify(view);
  for (const secret of SECRETS) assert.ok(!text.includes(secret), `leaked: ${secret} in ${text}`);
  assert.deepEqual(Object.keys(view).sort(), [...pub.PUBLIC_ASSET_FIELDS].sort());
});

test("public view keeps what the public may see: name, number, type, unit, brand/model, status, year, price and book value", () => {
  const view = plain(pub.toPublicAssetView(computer, valuation, "2026-11-09", { hostname: "DESKTOP-J7K8VSS" }));
  assert.equal(view.assetName, "TravelMate P214-52");
  assert.equal(view.registrationNo, "สสจ.7440-001-0006/120");
  assert.equal(view.facilityName, "สสจ.สตูล");
  assert.equal(view.workGroupName, "กลุ่มงานสุขภาพดิจิทัล");
  assert.equal(view.brandModel, "Acer TravelMate P214-52");
  assert.equal(view.acquiredYearBE, 2564);
  assert.equal(view.purchasePrice, 23500);
  assert.deepEqual(view.value, { status: "ok", bookValue: 9400.5, isFullyDepreciated: false, asOf: "2026-11-09" });
});

test("machine names, IPs and MACs are stripped from any asset name; an emptied name falls back to type + model", () => {
  assert.equal(pub.publicAssetName({ assetName: "PC 10.0.0.5 งานการเงิน" }), "PC งานการเงิน");
  assert.equal(pub.publicAssetName({ assetName: "LAPTOP-AB12CD3 / aa-bb-cc-dd-ee-ff" }, {}), "");
  assert.equal(pub.publicAssetName({ assetName: "WIN-SRV01", deviceType: "Server", manufacturerBrand: "Dell", manufacturerModel: "R740" }), "Server Dell R740");
  assert.equal(pub.publicAssetName({ assetName: "โต๊ะทำงานเหล็ก 5 ฟุต" }), "โต๊ะทำงานเหล็ก 5 ฟุต", "non-computer names are untouched");
  assert.equal(pub.publicAssetName({ assetName: "acct-pc-07 · HP ProDesk" }, { hostname: "ACCT-PC-07" }), "HP ProDesk", "the agent's own hostname is removed case-insensitively");
});

test("valuation is only exposed as a figure when it is computable", () => {
  const below = plain(pub.toPublicAssetView({ ...computer, purchasePrice: 4000 }, { status: "below-threshold", cost: 4000, bookValue: null, isFullyDepreciated: false }, "2026-11-09"));
  assert.deepEqual(below.value, { status: "below-threshold", bookValue: null, isFullyDepreciated: false, asOf: "2026-11-09" });
  const noDate = plain(pub.toPublicAssetView({ ...computer, purchaseDate: null }, { status: "missing-date", cost: 23500, bookValue: null, isFullyDepreciated: false }, "2026-11-09"));
  assert.equal(noDate.acquiredYearBE, null);
});
