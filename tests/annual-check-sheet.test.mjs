import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { buildCheckSheet, checkSheetDate, checkSheetDetail, checkSheetSigners, checkSheetStatusText, money } =
  loadTs("lib/annual-check-sheet.ts");

const statusLabel = (status) => ({ Broken: "ชำรุด", Inactive: "ไม่ใช้งาน" })[status] ?? status;

const asset = (overrides = {}) => ({
  id: 1,
  assetNumber: "สสจ.7440-001-0006/186/69",
  assetAccountingCode: "110000708882",
  assetName: "เครื่องคอมพิวเตอร์แบบที่ 1",
  assetClass: "IT",
  manufacturerBrand: "ASUS",
  purchasePrice: 24000,
  purchaseDate: "2026-06-16",
  workGroupName: "งานธุรการ",
  currentStatus: "Active",
  ...overrides,
});

test("วันที่แสดงเป็น พ.ศ. เต็มตามแบบฟอร์ม", () => {
  assert.equal(checkSheetDate("2024-03-15"), "15 มี.ค. 2567");
  assert.equal(checkSheetDate("2026-06-16"), "16 มิ.ย. 2569");
  assert.equal(checkSheetDate(null), "");
  assert.equal(checkSheetDate("ไม่ใช่วันที่", "-"), "-");
});

test("ช่องรายการรวมยี่ห้อ/รุ่น โดยไม่ซ้ำกับชื่อที่มีอยู่แล้ว", () => {
  assert.equal(checkSheetDetail(asset()), "เครื่องคอมพิวเตอร์แบบที่ 1 ยี่ห้อ ASUS");
  assert.equal(
    checkSheetDetail(asset({ assetName: "เครื่องพิมพ์ HP laserjet", manufacturerBrand: "HP", manufacturerModel: "laserjet" })),
    "เครื่องพิมพ์ HP laserjet"
  );
});

test("จัดกลุ่มตามประเภทครุภัณฑ์ และลำดับที่เรียงต่อเนื่องทั้งใบ", () => {
  const sheet = buildCheckSheet(
    [asset({ id: 1 }), asset({ id: 2, assetClass: "Office", assetName: "โต๊ะทำงาน", purchasePrice: 5000 }), asset({ id: 3 })],
    { yearBE: 2569, facilityName: "สำนักงานสาธารณสุขจังหวัดสตูล", workGroupName: "งานธุรการ" }
  );
  assert.equal(sheet.title, "ตรวจสอบพัสดุประจำปี 2569");
  assert.equal(sheet.groups.length, 2);
  assert.ok(sheet.groups.some((group) => group.label === "ครุภัณฑ์คอมพิวเตอร์"));
  assert.ok(sheet.groups.some((group) => group.label === "ครุภัณฑ์สำนักงาน"));
  const seqs = sheet.groups.flatMap((group) => group.rows.map((row) => row.seq)).sort((a, b) => a - b);
  assert.equal(seqs.join(","), "1,2,3");
  assert.equal(sheet.totalCount, 3);
});

test("ยอดรวมของแต่ละประเภทและยอดรวมทั้งใบถูกต้อง", () => {
  const sheet = buildCheckSheet(
    [asset({ id: 1, purchasePrice: 24000 }), asset({ id: 2, purchasePrice: 12500 }), asset({ id: 3, assetClass: "Office", purchasePrice: 5000 })],
    { yearBE: 2569, facilityName: "สสจ.สตูล" }
  );
  const it = sheet.groups.find((group) => group.label === "ครุภัณฑ์คอมพิวเตอร์");
  assert.equal(it.subtotal, 36500);
  assert.equal(sheet.grandTotal, 41500);
});

test("รายการที่ยังไม่มีราคาไม่ถูกนับในยอดรวม แต่ถูกนับจำนวนไว้เตือน", () => {
  const sheet = buildCheckSheet([asset({ id: 1, purchasePrice: null }), asset({ id: 2, purchasePrice: 100 })], {
    yearBE: 2569,
    facilityName: "สสจ.สตูล",
  });
  assert.equal(sheet.grandTotal, 100);
  assert.equal(sheet.missingPriceCount, 1);
  assert.equal(sheet.groups[0].rows[0].unitPrice === "" || sheet.groups[0].rows[1].unitPrice === "", true);
});

test("ยังไม่ได้ตรวจผ่านระบบ → ช่องสถานะพัสดุเว้นว่างไว้ให้กรรมการเขียน", () => {
  // ไม่ได้ระบุรอบตรวจนับเลย
  const noRound = buildCheckSheet([asset()], { yearBE: 2569, facilityName: "สสจ.สตูล" });
  assert.equal(noRound.groups[0].rows[0].status, "");

  // มีรอบ แต่ครุภัณฑ์ชิ้นนี้ยังไม่ถูกสแกน
  const notScanned = buildCheckSheet([asset({ id: 7 })], {
    yearBE: 2569,
    facilityName: "สสจ.สตูล",
    results: new Map([[7, { inspectionStatus: "Pending", assetStatus: "" }]]),
  });
  assert.equal(notScanned.groups[0].rows[0].status, "");

  // มีรอบ แต่ไม่มีระเบียนของชิ้นนี้เลย
  const missingRow = buildCheckSheet([asset({ id: 8 })], {
    yearBE: 2569,
    facilityName: "สสจ.สตูล",
    results: new Map([[99, { inspectionStatus: "Found", assetStatus: "Active" }]]),
  });
  assert.equal(missingRow.groups[0].rows[0].status, "");
});

test("ตรวจผ่านการสแกน QR แล้ว → ช่องสถานะพัสดุเติมตามผลตรวจ", () => {
  const sheet = buildCheckSheet(
    [
      asset({ id: 1, purchaseDate: "2024-01-01" }),
      asset({ id: 2, purchaseDate: "2024-02-01" }),
      asset({ id: 3, purchaseDate: "2024-03-01" }),
    ],
    {
      yearBE: 2569,
      facilityName: "สสจ.สตูล",
      statusLabel,
      results: new Map([
        [1, { inspectionStatus: "Found", assetStatus: "Active" }],
        [2, { inspectionStatus: "Found", assetStatus: "Broken" }],
        [3, { inspectionStatus: "Missing", assetStatus: "" }],
      ]),
    }
  );
  const byId = new Map(sheet.groups.flatMap((group) => group.rows).map((row) => [row.assetId, row.status]));
  assert.equal(byId.get(1), "ตรวจพบ");
  assert.equal(byId.get(2), "ตรวจพบ (ชำรุด)");
  assert.equal(byId.get(3), "ไม่พบ");
});

test("checkSheetStatusText ครอบคลุมทุกผลตรวจ", () => {
  assert.equal(checkSheetStatusText(undefined), "");
  assert.equal(checkSheetStatusText({ inspectionStatus: "Pending" }), "");
  assert.equal(checkSheetStatusText({ inspectionStatus: "Missing" }), "ไม่พบ");
  assert.equal(checkSheetStatusText({ inspectionStatus: "Found", assetStatus: "Active" }), "ตรวจพบ");
  assert.equal(checkSheetStatusText({ inspectionStatus: "Found", assetStatus: null }), "ตรวจพบ");
  assert.equal(checkSheetStatusText({ inspectionStatus: "Found", assetStatus: "Inactive" }, statusLabel), "ตรวจพบ (ไม่ใช้งาน)");
});

test("ช่องลงนามแยกประธานกับกรรมการ และเติมบรรทัดว่างให้ครบ", () => {
  const signers = checkSheetSigners([
    { role: "member", fullName: "นางสาวดรุณี หมาดมาสัน" },
    { role: "chair", fullName: "นางนิรมล เผือกสม" },
  ]);
  assert.equal(signers.chair.fullName, "นางนิรมล เผือกสม");
  assert.equal(signers.chair.label, "ประธานกรรมการ");
  assert.equal(signers.members.length, 3);
  assert.equal(signers.members[0].fullName, "นางสาวดรุณี หมาดมาสัน");
  assert.equal(signers.members[2].fullName, "");
  assert.ok(signers.members.every((member) => member.label === "กรรมการ"));
});

test("จำนวนเงินจัดรูปแบบสองตำแหน่ง", () => {
  assert.equal(money(12500), "12,500.00");
  assert.equal(money(null), "");
});
