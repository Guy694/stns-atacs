import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const quality = loadTs("lib/data-quality.ts", {}, { Math, Number, String, Object });
const acquisition = loadTs("lib/acquisition-options.ts", {}, { String });
const input = loadTs("lib/asset-input.ts", {}, { Math, Number, String, Object, Intl });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("acquisition options accept codes, Thai labels and aliases; unknown values are rejected", () => {
  assert.equal(acquisition.parseFundingSource("Budget"), "Budget");
  assert.equal(acquisition.parseFundingSource(" เงินบำรุง "), "Maintenance");
  assert.equal(acquisition.parseFundingSource(""), "");
  assert.equal(acquisition.parseAcquisitionMethod("e-bidding"), "EBidding");
  assert.equal(acquisition.parseAcquisitionMethod("เฉพาะเจาะจง"), "Specific");
  assert.throws(() => acquisition.parseAcquisitionMethod("ซื้อเอง"), /วิธีการได้มาไม่ถูกต้อง/);
  assert.equal(acquisition.fundingSourceLabel("Donation"), "เงินบริจาค");
});

test("asset input parses acquisition fields and validates the warranty date", () => {
  const parsed = input.parseAssetFields({ assetName: "เก้าอี้", assetClass: "Office", fundingSource: "เงินงบประมาณ", acquisitionMethod: "Specific", vendorName: " ร้านตัวอย่าง ", unitName: "ตัว", warrantyEndDate: "2028-01-31" });
  assert.deepEqual(plain({ f: parsed.fundingSource, m: parsed.acquisitionMethod, v: parsed.vendorName, u: parsed.unitName, w: parsed.warrantyEndDate }), { f: "Budget", m: "Specific", v: "ร้านตัวอย่าง", u: "ตัว", w: "2028-01-31" });
  assert.throws(() => input.parseAssetFields({ assetName: "เก้าอี้", assetClass: "Office", warrantyEndDate: "2028-02-30" }), /warrantyEndDate/);
  assert.throws(() => input.parseAssetFields({ assetName: "เก้าอี้", assetClass: "Office", unitName: "x".repeat(31) }), /หน่วยนับ/);
});

test("quality score counts only applicable cells of available checks", () => {
  const row = (facilityId, checks, assets = 10) => ({ facilityId, facilityName: `หน่วย ${facilityId}`, districtName: "", assets, checks });
  const rows = [
    row(1, { number: { applicable: 10, missing: 0 }, price: { applicable: 10, missing: 5 }, accountingCode: { applicable: 4, missing: 4 } }),
    row(2, { number: { applicable: 10, missing: 0 }, price: { applicable: 10, missing: 0 }, accountingCode: { applicable: 0, missing: 0 } }),
  ];
  const summary = quality.summarizeQuality(rows, ["number", "price", "accountingCode"]);
  assert.equal(summary.facilities[0].facilityId, 1);
  assert.equal(summary.facilities[0].score, 15 / 24);
  assert.equal(summary.facilities[0].grade, "poor");
  assert.equal(summary.facilities[1].score, 1);
  assert.equal(summary.total.missing, 9);
  assert.equal(summary.total.applicable, 44);
  // checks not available in this database are ignored
  assert.equal(quality.scoreFacility(rows[0], ["number"]).score, 1);
  assert.deepEqual(plain(summary.checkTotals.map((c) => [c.key, c.missing])), [["number", 0], ["price", 5], ["accountingCode", 4]]);
});

test("placeholder serial numbers are not duplicates", () => {
  assert.equal(quality.isMeaningfulSerial("-"), false);
  assert.equal(quality.isMeaningfulSerial("n/a"), false);
  assert.equal(quality.isMeaningfulSerial("ไม่มี"), false);
  assert.equal(quality.isMeaningfulSerial("SN12345"), true);
});
