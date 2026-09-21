import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
const { validateAssetDetails } = loadTs("lib/asset-details.ts");
const { parseAssetFields } = loadTs("lib/asset-input.ts");

test("specific fields reject wrong classes, impossible dates and invalid quantities", () => {
  for (const [group, details] of [["Office", { license_plate: "X" }], ["Medical", { calibration_date: "2025-02-30" }], ["Vehicle", { odometer_km: "-1" }], ["Building", { floor_count: "1.5" }], ["Medical", { calibration_date: "2026-02-01", next_calibration_date: "2026-01-01" }]]) assert.throws(() => validateAssetDetails(group, details));
  assert.equal(validateAssetDetails("Vehicle", { license_plate: " กข 123 " }).license_plate, "กข 123");
});

test("form patches distinguish omitted fields from explicit clearing and validate against stored dates", () => {
  const current = { assetName: "Medical", assetClass: "Medical", extensions: { Medical: { details: { calibration_date: "2026-05-01" } } } };
  assert.equal(parseAssetFields({}, current).details, undefined);
  assert.equal(parseAssetFields({ detail_calibration_date: "" }, current).details.calibration_date, "");
  assert.throws(() => parseAssetFields({ detail_next_calibration_date: "2026-01-01" }, current));
  assert.throws(() => parseAssetFields({ assetName: "PC", subtypeId: "1" }));
});

test("inactive subtype can be retained but cannot be newly selected", async () => {
  const writes = [];
  const api = loadTs("lib/asset-extensions.ts", { "@/lib/mysql": {
    selectRows: async sql => sql.includes("FROM asset_extensions") ? [{ subtype_id: 7, schema_version: 1, details: { license_plate: "old", engine_number: "engine" } }] : [{ asset_class: "Vehicle", is_active: 0 }],
    executeStatement: async (sql, values) => writes.push({ sql, values }),
  } });
  await api.saveAssetExtension(1, "Vehicle", 7, { license_plate: "new" });
  assert.deepEqual(JSON.parse(writes[0].values[3]), { license_plate: "new", engine_number: "engine" });
  await assert.rejects(api.saveAssetExtension(1, "Vehicle", 8, {}), /ปิดใช้งาน/);
  await assert.rejects(api.saveAssetExtension(1, "Office", 7, {}), /กลุ่ม/);
});
