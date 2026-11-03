import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const v = loadTs("lib/asset-valuation.ts");
const r = loadTs("lib/asset-register.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

const cases = [
  { assetClass: "IT", assetCategory: "Hardware", purchasePrice: 30001, purchaseDate: "2023-10-01" },
  { assetClass: "IT", assetCategory: "Hardware", purchasePrice: 45000, purchaseDate: "2024-01-15" },
  { assetClass: "IT", assetCategory: "Hardware", purchasePrice: 18990, purchaseDate: "2025-06-03" },
];

test("valuation report and the printed register charge the same depreciation every fiscal year (table rate)", () => {
  for (const asset of cases) {
    const life = v.resolveUsefulLife(asset);
    const register = r.buildRegisterSchedule({ cost: asset.purchasePrice, acquiredOn: asset.purchaseDate, lifeYears: life.years, annualRatePercent: life.annualRate });
    const valuation = v.depreciationSchedule(asset);
    assert.deepEqual(plain(valuation.map((row) => row.fiscalYear)), plain(register.rows.map((row) => row.fiscalYear)), asset.purchaseDate);
    assert.deepEqual(plain(valuation.map((row) => row.depreciation)), plain(register.rows.map((row) => row.depreciation)), asset.purchaseDate);
    for (const row of register.rows) {
      assert.equal(v.depreciationForFiscalYear(asset, row.fiscalYear), row.depreciation);
      assert.equal(v.valueAsset(asset, row.endDate).bookValue, row.bookValue);
    }
    assert.equal(v.valueAsset(asset, "2099-01-01").bookValue, 1);
    assert.equal(v.valueAsset(asset, "2099-01-01").fullyDepreciatedOn, register.endOn);
  }
});

test("a computer at the 33% table rate: 9,900.33 per full year, the rest in the last year", () => {
  const rows = v.depreciationSchedule(cases[0]);
  assert.deepEqual(plain(rows.map((row) => row.depreciation)), [9900.33, 9900.33, 10199.34]);
  assert.equal(v.valueAsset(cases[0], "2025-03-31").annualDepreciation, 9900.33);
});
