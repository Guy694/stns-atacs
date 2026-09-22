import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const XLSX = createRequire(import.meta.url)("xlsx");
const globals = { URLSearchParams, Intl, Math, Number, String, Buffer };
const report = loadTs("lib/inspection-report.ts", {}, globals);
const scan = loadTs("lib/asset-scan.ts", {}, globals);
const plain = value => JSON.parse(JSON.stringify(value));
const item = (id, extra) => ({ id, assetId: id, assetName: `รายการ ${id}`, assetRegistrationNo: `${id}`, assetNumber: `สสจ.${id}`, currentStatus: "Active", inspectionStatus: "Found", assetClass: "IT", assetGroup: "Hardware", subtypeName: "", workGroupId: 10, workGroupName: "กลุ่มงานบริหาร", locationDetail: "", purchaseDate: "2024-10-05", installedAt: "", purchasePrice: 20000, ...extra });
const items = [
  item(1),
  item(2, { inspectionAssetStatus: "Broken" }),
  item(3, { currentStatus: "Inactive", assetClass: "Office" }),
  item(4, { inspectionStatus: "Missing", purchasePrice: 1500.5 }),
  item(5, { inspectionStatus: "Pending", purchasePrice: null }),
];

test("itemOutcome maps inspection result and recorded status", () => {
  assert.deepEqual(items.map(report.itemOutcome), ["usable", "broken", "unused", "missing", "pending"]);
  // the status recorded during the check wins over the asset's current status
  assert.equal(report.itemOutcome(item(9, { currentStatus: "Broken", inspectionAssetStatus: "Active" })), "usable");
});

test("summarizeInspection counts and values per category and proposes broken/unused/missing", () => {
  const summary = report.summarizeInspection(items);
  assert.equal(summary.totals.total, 5);
  assert.equal(summary.totals.value, 61500.5);
  assert.deepEqual(plain(summary.totals.counts), { usable: 1, broken: 1, unused: 1, missing: 1, pending: 1 });
  assert.equal(summary.rows.length, 2);
  assert.equal(summary.rows.reduce((n, r) => n + r.total, 0), 5);
  assert.deepEqual(plain(summary.proposed.map(i => i.id)).sort(), [2, 3, 4]);
});

test("report workbook: summary + proposal sheets, draft marker until closed", () => {
  const meta = { roundName: "การตรวจสอบพัสดุประจำปี 2569", facilityName: "สสจ.สตูล", districtName: "", workGroupName: "", filterLabel: "", committee: [{ seq: 1, role: "chair", fullName: "นายประธาน ใจดี", position: "" }], startDate: "2026-10-01", endDate: "2026-10-31", closedAt: "", roundStatus: "Open" };
  const open = XLSX.read(report.buildInspectionReportWorkbook(items, meta).buffer, { type: "buffer" });
  assert.equal(open.SheetNames.length, 3);
  const text = wb => wb.SheetNames.map(n => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
  assert.match(text(open), /ฉบับร่าง/);
  assert.match(text(open), /นายประธาน ใจดี/);
  assert.match(text(open), /สสจ\.4/);
  const closedMeta = { ...meta, roundStatus: "Closed", closedAt: "2026-11-01 10:00:00" };
  const closed = XLSX.read(report.buildInspectionReportWorkbook(items, closedMeta).buffer, { type: "buffer" });
  assert.doesNotMatch(text(closed), /ฉบับร่าง/);
});

test("assetIdFromScan reads asset URLs only", () => {
  assert.equal(scan.assetIdFromScan("https://atacs.example/assets/123"), 123);
  assert.equal(scan.assetIdFromScan(" https://atacs.example/scan/assets/45?x=1 "), 45);
  assert.equal(scan.assetIdFromScan("/assets/7#check-in-heading"), 7);
  assert.equal(scan.assetIdFromScan("https://atacs.example/assets/12abc"), null);
  assert.equal(scan.assetIdFromScan("hello"), null);
});

test("report prints the committee appointment order when recorded", () => {
  const sheetLib = loadTs("lib/inspection-sheet.ts", {}, globals);
  assert.equal(sheetLib.committeeOrderText({}), "");
  assert.equal(sheetLib.committeeOrderText({ committeeOrderNo: "125/2570", committeeOrderDate: "2026-10-01" }), "ตามคำสั่งแต่งตั้งคณะกรรมการตรวจสอบพัสดุ ที่ 125/2570 ลงวันที่ 1 ต.ค. 2569");
  const meta = { roundName: "รอบ", facilityName: "สสจ.", districtName: "", workGroupName: "", filterLabel: "", committee: [], startDate: "2026-10-01", endDate: "", closedAt: "", roundStatus: "Closed", committeeOrderNo: "125/2570" };
  const wb = XLSX.read(report.buildInspectionReportWorkbook(items, meta).buffer, { type: "buffer" });
  assert.match(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]), /ตามคำสั่งแต่งตั้งคณะกรรมการตรวจสอบพัสดุ ที่ 125\/2570/);
});

test("items found in another work group are reported with the register first", () => {
  const sheetLib = loadTs("lib/inspection-sheet.ts", {}, globals);
  const base = item(20, { workGroupId: 1, workGroupName: "กลุ่มงานบริหาร", locationDetail: "ห้อง 101" });
  assert.equal(sheetLib.isFoundElsewhere({ ...base, foundWorkGroupId: 1, registeredWorkGroupId: 1 }), false);
  const moved = { ...base, foundWorkGroupId: 2, foundWorkGroupName: "กลุ่มงานควบคุมโรค", foundLocation: "ห้อง 205", registeredWorkGroupId: 1, registeredWorkGroupName: "กลุ่มงานบริหาร" };
  assert.equal(sheetLib.isFoundElsewhere(moved), true);
  assert.equal(sheetLib.registeredLocation(moved), "กลุ่มงานบริหาร (ห้อง 101)");
  assert.equal(sheetLib.foundLocationText(moved), "กลุ่มงานควบคุมโรค (ห้อง 205)");
  // same group, different room
  assert.equal(sheetLib.isFoundElsewhere({ ...base, foundWorkGroupId: 1, foundLocation: "ห้อง 102" }), true);
  // missing items are never "moved"
  assert.equal(sheetLib.isFoundElsewhere({ ...moved, inspectionStatus: "Missing" }), false);
  // the register was updated afterwards: the snapshot still shows where it was registered
  assert.equal(sheetLib.isFoundElsewhere({ ...moved, workGroupId: 2, workGroupName: "กลุ่มงานควบคุมโรค" }), true);

  const summary = report.summarizeInspection([...items, moved]);
  assert.equal(summary.moved.length, 1);
  const meta = { roundName: "รอบ", facilityName: "สสจ.", districtName: "", workGroupName: "", filterLabel: "", committee: [], startDate: "2026-10-01", endDate: "", closedAt: "", roundStatus: "Closed" };
  const wb = XLSX.read(report.buildInspectionReportWorkbook([...items, moved], meta).buffer, { type: "buffer" });
  const text = XLSX.utils.sheet_to_csv(wb.Sheets["พบต่างสถานที่"]);
  assert.match(text, /กลุ่มงานบริหาร \(ห้อง 101\)/);
  assert.match(text, /กลุ่มงานควบคุมโรค \(ห้อง 205\)/);
  assert.match(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]), /พบต่างจากกลุ่มงาน\/สถานที่ในทะเบียน 1 รายการ/);
});
