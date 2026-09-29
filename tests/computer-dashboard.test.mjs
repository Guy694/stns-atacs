import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { summarizeComputerDashboard, osFamily, ageBucket, topCounts } = loadTs("lib/computer-dashboard.ts");

const asset = (overrides = {}) => ({
  assetClass: "IT", assetGroup: "Hardware", deviceType: "คอมพิวเตอร์ตั้งโต๊ะ", operatingSystem: "Windows 11 Pro",
  manufacturerBrand: "Dell", windowsLicenseStatus: "Genuine", currentStatus: "Active", purchaseDate: "2024-01-01", ...overrides,
});

test("นับฮาร์ดแวร์ ซอฟต์แวร์ คอมพิวเตอร์ และลิขสิทธิ์ Windows", () => {
  const summary = summarizeComputerDashboard([
    asset(),
    asset({ windowsLicenseStatus: "Pirated", currentStatus: "Broken" }),
    asset({ windowsLicenseStatus: null, purchaseDate: "2015-01-01" }),
    asset({ deviceType: "Printer", windowsLicenseStatus: null }),
    asset({ assetGroup: "Software", deviceType: "Microsoft Office" }),
    asset({ assetClass: "Office", deviceType: "โต๊ะ" }),
  ], "2026-09-29");
  assert.equal(summary.total, 5);
  assert.equal(summary.hardware, 4);
  assert.equal(summary.software, 1);
  assert.equal(summary.computers, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(summary.license)), { genuine: 1, nonGenuine: 1, unreported: 1 });
  assert.equal(summary.genuineRate, 33);
  assert.equal(summary.status.broken, 1);
  assert.equal(summary.agingComputers, 1);
});

test("จัดกลุ่มระบบปฏิบัติการ", () => {
  assert.equal(osFamily("Windows 10 Pro 64-bit"), "Windows 10");
  assert.equal(osFamily("Win 7"), "Windows 7");
  assert.equal(osFamily("Windows Server 2019"), "Windows Server");
  assert.equal(osFamily("Ubuntu 22.04"), "Linux");
  assert.equal(osFamily("ไม่ระบุ"), "");
});

test("อายุเครื่องและการรวม อื่น ๆ / ไม่ระบุ", () => {
  assert.equal(ageBucket("2025-01-01", "2026-09-29"), "ไม่เกิน 3 ปี");
  assert.equal(ageBucket("2018-01-01", "2026-09-29"), "เกิน 7 ปี");
  assert.equal(ageBucket("", "2026-09-29"), "ไม่ระบุวันที่ได้มา");
  const rows = topCounts(["a", "a", "b", "c", "", "ไม่ระบุ"], 2);
  assert.equal(rows.map((r) => `${r.label}:${r.count}`).join(","), "a:2,b:1,อื่น ๆ:1,ไม่ระบุ:2");
});
