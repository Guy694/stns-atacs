import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const XLSX = createRequire(import.meta.url)("xlsx");
const sheetLib = loadTs("lib/inspection-sheet.ts", {}, { URLSearchParams, Intl, Math, Number, String, Buffer });
const item = (id, extra) => ({ id, assetId: id, assetName: `รายการ ${id}`, assetRegistrationNo: `REG-${id}`, currentStatus: "Active", inspectionStatus: "Pending", assetClass: "IT", assetGroup: "Hardware", subtypeName: "", workGroupId: 10, workGroupName: "กลุ่มงานบริหาร", locationDetail: "", purchaseDate: "2024-10-05", installedAt: "", purchasePrice: 25000, ...extra });
const items = [
  item(3, { workGroupId: 20, workGroupName: "กลุ่มงานบริการ", locationDetail: "ห้องฉุกเฉิน", assetRegistrationNo: "REG-10" }),
  item(1, { assetClass: "Office", purchasePrice: 4500, currentStatus: "Broken", inspectionStatus: "Found" }),
  item(2, { workGroupId: null, workGroupName: "", purchasePrice: null, purchaseDate: "", installedAt: "2023-01-02" }),
];
const plain = value => JSON.parse(JSON.stringify(value));

test("filters: category, work group (including none) and result; unknown values ignored", () => {
  assert.deepEqual(plain(sheetLib.readInspectionItemFilters({ category: "3", location: "none", result: "Found" })), { category: "3", location: "none", result: "Found" });
  assert.deepEqual(plain(sheetLib.readInspectionItemFilters(new URLSearchParams("category=x&location=drop&result=Other"))), { category: "", location: "", result: "" });
  const f = (filters) => sheetLib.filterInspectionItems(items, { category: "", location: "", result: "", ...filters }).map(i => i.id);
  assert.deepEqual(f({ category: "3" }), [1]);
  assert.deepEqual(f({ location: "none" }), [2]);
  assert.deepEqual(f({ location: "20" }), [3]);
  assert.deepEqual(f({ result: "Found" }), [1]);
  const options = sheetLib.inspectionFilterOptions(items);
  assert.deepEqual(plain(options.locations.map(o => [o.value, o.count])), [["20", 1], ["10", 1], ["none", 1]]);
  assert.equal(sheetLib.itemLocation(items[0]), "กลุ่มงานบริการ (ห้องฉุกเฉิน)");
  assert.equal(sheetLib.itemLocation(items[2]), "ไม่ระบุกลุ่มงาน");
});

test("count sheet: one sheet per category, requested headers, Thai dates, totals and committee", () => {
  const committee = [{ seq: 1, fullName: "นายประธาน ใจดี", position: "นักวิชาการพัสดุชำนาญการ" }, { seq: 2, fullName: "นางกรรมการ หนึ่ง", position: "" }];
  const priced = items.map(item => ({ ...item, assetNumber: `สสจ.${item.assetRegistrationNo}`, assetAccountingCode: item.id === 3 ? "110000490204" : "" }));
  const { buffer, rowCount, sheetNames } = sheetLib.buildInspectionWorkbook(priced, { roundName: "การตรวจสอบพัสดุประจำปี 2569", facilityName: "สำนักงานสาธารณสุขจังหวัดสตูล", districtName: "", workGroupName: "กลุ่มงานบริหารทั่วไป", filterLabel: "", committee });
  assert.equal(rowCount, 3);
  assert.deepEqual(plain(sheetNames), ["ครุภัณฑ์สำนักงาน", "ครุภัณฑ์คอมพิวเตอร์"]);
  const parsed = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(parsed.Sheets["ครุภัณฑ์คอมพิวเตอร์"], { header: 1, defval: "" });
  assert.equal(rows[0][0], "การตรวจสอบพัสดุประจำปี 2569");
  assert.equal(rows[1][0], "สำนักงานสาธารณสุขจังหวัดสตูล");
  assert.equal(rows[2][0], "กลุ่มงานบริหารทั่วไป");
  assert.equal(rows[4][0], "ครุภัณฑ์คอมพิวเตอร์");
  assert.deepEqual(rows[5], ["ลำดับที่", "วัน เดือน ปี ที่ได้มา", "เลขครุภัณฑ์", "รหัสสินทรัพย์", "รายการ", "จำนวนหน่วย", "มูลค่าการได้มา", "มูลค่ารวม", "ใช้ประจำที่ไหน", "สถานะพัสดุ"]);
  const [first, second] = rows.slice(6, 8);
  assert.deepEqual(first.slice(0, 4), [1, "5 ต.ค. 2567", "สสจ.REG-10", "110000490204"]);
  assert.equal(first[8], "กลุ่มงานบริการ");
  assert.equal(second[1], "2 ม.ค. 2566", "installation date is the fallback, printed as a Thai date");
  assert.equal(second[3], "", "no price: not labelled below threshold");
  assert.equal(second[6], "", "unknown price stays blank rather than 0");
  assert.equal(rows[8][0], "รวม");
  assert.equal(rows[8][5], 2);
  assert.equal(rows[8][7], 25000);
  const text = rows.flat().join("|");
  assert.match(text, /\(นายประธาน ใจดี\)/);
  assert.match(text, /ตำแหน่ง นักวิชาการพัสดุชำนาญการ/);
  assert.equal((text.match(/ลงชื่อ/g) ?? []).length, 4, "chair + 3 members");
  const office = XLSX.utils.sheet_to_json(parsed.Sheets["ครุภัณฑ์สำนักงาน"], { header: 1, defval: "" });
  assert.equal(office[6][3], "ต่ำกว่าเกณฑ์", "items under 10,000 baht without a code are marked below threshold");
  assert.equal(office[6][9], "ชำรุด", "a recorded result is printed; unchecked items stay blank");
  assert.equal(parsed.Sheets["ครุภัณฑ์คอมพิวเตอร์"].H7.f, "F7*G7");
});

test("Thai date and asset number helpers", () => {
  assert.equal(sheetLib.thaiDate("2018-12-07"), "7 ธ.ค. 2561");
  assert.equal(sheetLib.thaiDate(""), "");
  const { formatAssetNumber } = loadTs("lib/asset-number.ts");
  assert.equal(formatAssetNumber("สสจ.", "123"), "สสจ.123");
  assert.equal(formatAssetNumber("สสจ.", "สสจ.7440-001/60"), "สสจ.7440-001/60", "legacy numbers that already carry the prefix are not doubled");
  assert.equal(formatAssetNumber("", "123"), "123");
  assert.equal(formatAssetNumber("สสจ.", ""), "");
});
