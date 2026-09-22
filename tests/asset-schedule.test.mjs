import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { ASSET_CLASS_OPTIONS, ASSET_CREATE_CLASS_OPTIONS } = loadTs("lib/asset-classes.ts");
const { parseAssetFields } = loadTs("lib/asset-input.ts");
const { dashboardCategoryId } = loadTs("lib/asset-depreciation.ts");
const { ASSET_DETAIL_FIELDS, validateAssetDetails } = loadTs("lib/asset-details.ts");
const { parseAssetListQuery } = loadTs("lib/asset-list-query.ts");

test("each of the 20 selectable classes can be saved and maps to its schedule category", () => {
  assert.equal(ASSET_CREATE_CLASS_OPTIONS.length, 20);
  for (const option of ASSET_CREATE_CLASS_OPTIONS) {
    const fields = parseAssetFields({ assetClass: option.value, assetName: "Test", currentStatus: "Active" });
    assert.equal(fields.assetClass, option.value);
    assert.equal(dashboardCategoryId(fields), option.categoryId);
    if (option.value !== "IT") {
      assert.ok(ASSET_DETAIL_FIELDS[option.value]);
      const key = ASSET_DETAIL_FIELDS[option.value][0].key;
      assert.ok(validateAssetDetails(option.value, { [key]: "" }));
    }
  }
  assert.ok(ASSET_CLASS_OPTIONS.some(item => item.value === "Building"));
  assert.ok(ASSET_CLASS_OPTIONS.some(item => item.value === "Utility"));
  assert.equal(parseAssetFields({ assetName: "Edit" }, { assetClass: "Building" }).assetClass, "Building");
  assert.equal(dashboardCategoryId({ assetClass: "IT", assetCategory: "Software" }), 20);
});

test("subtype filters are validated and shared by list and export queries", () => {
  const filter = parseAssetListQuery(new URLSearchParams("assetClass=Electrical&subtype=42&search=generator"));
  assert.equal(filter.subtypeId, 42);
  assert.equal(filter.assetClass, "Electrical");
  assert.equal(filter.search, "generator");
  for (const value of ["-1", "1.5", "abc", "1 OR 1=1"]) assert.throws(() => parseAssetListQuery(new URLSearchParams({ subtype: value })));
});

test("list and count constrain subtype to the current class and facility, using parameters", async () => {
  const calls = [];
  const repository = loadTs("lib/assets.ts", { "@/lib/mysql": {
    selectRows: async (sql, values) => { calls.push({ sql, values }); return sql.includes("COUNT(*)") ? [{ total: 0 }] : []; },
  } });
  const filter = { facilityId: 7, assetClass: "Electrical", subtypeId: 42 };
  await repository.listAssets(filter);
  await repository.countAssets(filter);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /sx\.asset_class = a\.asset_class AND sx\.subtype_id = \?/);
    assert.match(call.sql, /s\.facility_id = \?/);
    assert.deepEqual(JSON.parse(JSON.stringify(call.values)), [7, "Electrical", 42]);
  }
});

test("intangible filter includes legacy IT software; computer filter excludes it", async () => {
  const assets = [
    { id: 1, assetClass: "IT", assetGroup: "Software", assetName: "Legacy software" },
    { id: 2, assetClass: "Intangible", assetGroup: "Hardware", assetName: "New software" },
    { id: 3, assetClass: "IT", assetGroup: "Hardware", assetName: "Computer" },
  ];
  const repository = loadTs("lib/assets.ts", {
    "@/lib/mysql": { selectRows: async () => { throw new Error("Use fixture"); } },
    "@/app/atacs-data": { facilitySurveys: [{ facilityId: 1, facilityName: "Test", districtName: "Test", assets }] },
  });
  assert.deepEqual(JSON.parse(JSON.stringify((await repository.listAssets({ assetClass: "Intangible" })).map(asset => asset.id))), [1, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify((await repository.listAssets({ assetClass: "IT" })).map(asset => asset.id))), [3]);
});
