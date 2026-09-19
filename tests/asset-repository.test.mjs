import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup(linked = []) {
  const writes = [], reads = [];
  const repository = loadTs("lib/assets.ts", {
    "@/app/atacs-data": { facilitySurveys: [] },
    "@/lib/mysql": {
      selectRows: async (sql, values) => { reads.push({ sql, values }); return sql.includes("EXISTS (SELECT 1 FROM agent_devices") ? linked : []; },
      executeStatement: async (sql, values) => { writes.push({ sql, values }); return { insertId: 1 }; },
    },
  });
  return { repository, writes, reads };
}

test("name-only repository update never writes dates, license or classification", async () => {
  const { repository, writes } = setup();
  await repository.updateAsset(1, { assetName: "Renamed" });
  assert.equal(writes[0].sql, "UPDATE information_assets SET asset_name = ? WHERE id = ?");
  assert.deepEqual(Array.from(writes[0].values), ["Renamed", 1]);
});

test("explicit null and empty dates clear only the fields requested", async () => {
  const { repository, writes } = setup();
  await repository.updateAsset(1, { purchaseDate: null, maintenanceEndDate: "" });
  assert.equal(writes[0].sql, "UPDATE information_assets SET purchase_date = ?, maintenance_end_date = ? WHERE id = ?");
  assert.deepEqual(Array.from(writes[0].values), [null, null, 1]);
});

test("linked Agent blocks incompatible classification and relocation, allows eligible IT edits", async () => {
  const { repository, writes } = setup([{ asset_class: "IT", asset_category: "Hardware", device_type: "Desktop", survey_id: 9 }]);
  for (const patch of [{ assetClass: "Vehicle" }, { assetCategory: "Software" }, { deviceType: "Printer" }, { surveyId: 10 }]) {
    await assert.rejects(repository.updateAsset(1, patch), /Agent/);
  }
  assert.equal(writes.length, 0);
  await repository.updateAsset(1, { assetClass: "IT", deviceType: "Notebook", surveyId: 9 });
  assert.equal(writes.length, 1);
});

test("unknown explicit class cannot be written and missing create class defaults to IT", async () => {
  const { repository, writes } = setup();
  await assert.rejects(repository.updateAsset(1, { assetClass: "Typo" }));
  await assert.rejects(repository.createAsset({ surveyId: 1, assetName: "Desk", assetCategory: "Hardware", assetClass: "Typo" }));
  assert.equal(writes.length, 0);
  await repository.createAsset({ surveyId: 1, assetName: "PC", assetRegistrationNo: null, assetCategory: "Hardware" });
  assert.ok(writes[0].values.includes("IT"));
});

test("Hardware/Software filters always constrain IT and SQL values remain parameterized", async () => {
  const { repository, reads } = setup();
  await repository.listAssets({ assetGroup: "Hardware", assetClass: "Office", search: "' OR 1=1", limit: 25, offset: 25 });
  assert.match(reads[0].sql, /TRIM\(a.asset_class\).*'IT'.*a.asset_category = \?/);
  assert.ok(!reads[0].sql.includes("' OR 1=1"));
  assert.ok(reads[0].values.includes("Office"));
  assert.deepEqual(Array.from(reads[0].values.slice(-2)), [25, 25]);
});
