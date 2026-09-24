import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { buildDepreciationRollup } = loadTs("lib/depreciation-rollup.ts");

// คอมพิวเตอร์ อายุ 3 ปี: ได้มา 1 ต.ค. 2565 (2022-10-01) ราคา 30,000 → ค่าเสื่อมปีละ 10,000
const computer = (overrides = {}) => ({
  assetClass: "IT",
  assetCategory: "Hardware",
  deviceType: "คอมพิวเตอร์",
  subtypeName: "เครื่องคอมพิวเตอร์",
  purchasePrice: 30000,
  purchaseDate: "2022-10-01",
  currentStatus: "Active",
  facilityId: 1,
  facilityName: "รพ.สต. ก",
  ...overrides,
});

test("ยอดยกมา + ค่าเสื่อมปีนี้ = ยอดยกไป", () => {
  const rollup = buildDepreciationRollup([computer()], 2567);
  assert.equal(rollup.periodStart, "2023-10-01");
  assert.equal(rollup.periodEnd, "2024-09-30");
  assert.equal(rollup.balanced, true);
  assert.equal(
    Math.round((rollup.totals.openingAccumulated + rollup.totals.depreciationThisYear) * 100) / 100,
    rollup.totals.closingAccumulated
  );
  assert.ok(rollup.totals.depreciationThisYear > 0);
});

test("มูลค่าสุทธิยกไป = ราคาทุน − ค่าเสื่อมสะสมยกไป", () => {
  const rollup = buildDepreciationRollup([computer(), computer({ facilityId: 2, facilityName: "รพ.สต. ข" })], 2567);
  assert.equal(
    Math.round((rollup.totals.cost - rollup.totals.closingAccumulated) * 100) / 100,
    rollup.totals.closingBookValue
  );
  assert.equal(rollup.rows.length, 2);
});

test("แยกตามหน่วยงานและรวมยอดถูกต้อง", () => {
  const rollup = buildDepreciationRollup(
    [computer(), computer(), computer({ facilityId: 2, facilityName: "รพ.สต. ข" })],
    2567
  );
  const first = rollup.rows.find((row) => row.facilityId === 1);
  const second = rollup.rows.find((row) => row.facilityId === 2);
  assert.equal(first.count, 2);
  assert.equal(second.count, 1);
  assert.equal(rollup.totals.count, 3);
  assert.equal(Math.round((first.cost + second.cost) * 100) / 100, rollup.totals.cost);
});

test("ไม่นับครุภัณฑ์ที่จำหน่าย/สูญหาย และนับรายการข้อมูลไม่ครบแยกต่างหาก", () => {
  const rollup = buildDepreciationRollup(
    [
      computer(),
      computer({ currentStatus: "Disposed" }),
      computer({ currentStatus: "Lost" }),
      computer({ purchasePrice: null }),
      computer({ purchaseDate: null }),
    ],
    2567
  );
  assert.equal(rollup.excludedTerminal, 2);
  assert.equal(rollup.totals.incomplete, 2);
  assert.equal(rollup.totals.count, 1);
});

test("ครุภัณฑ์ที่ครบอายุแล้วไม่คิดค่าเสื่อมเพิ่มในปีถัดไป", () => {
  const later = buildDepreciationRollup([computer()], 2570);
  assert.equal(later.totals.depreciationThisYear, 0);
  assert.equal(later.totals.fullyDepreciated, 1);
  assert.equal(later.balanced, true);
});
