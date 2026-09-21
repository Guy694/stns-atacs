import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import mysql from "mysql2/promise";
import { loadTs } from "./helpers/load-ts.mjs";

// This suite only connects to an explicitly supplied, isolated localhost test database.
const port = Number(process.env.ATACS_TEST_MYSQL_PORT);
test("MySQL migration, constraints, atomic writes, class retention and search", { skip: !port }, async () => {
  const config = { host: "127.0.0.1", port, user: "root", password: "", database: "atacs_test", multipleStatements: true };
  const connection = await mysql.createConnection(config);
  const globalState = {};
  const db = loadTs("lib/mysql.ts", { "mysql2/promise": mysql }, { global: globalState, process: { env: { MYSQL_HOST: config.host, MYSQL_PORT: String(port), MYSQL_USER: "root", MYSQL_PASSWORD: "test", MYSQL_DATABASE: config.database } } });
  // Inject a pool bound exclusively to the disposable test database.
  globalState.__atacsMysqlPool = mysql.createPool({ ...config, multipleStatements: false });
  const repository = loadTs("lib/assets.ts", { "@/lib/mysql": db, "@/app/atacs-data": { facilitySurveys: [] } });
  const extensions = loadTs("lib/asset-extensions.ts", { "@/lib/mysql": db });
  try {
    await connection.query("CREATE TABLE health_facilities (id INT PRIMARY KEY, name VARCHAR(255), district_name VARCHAR(255)); INSERT INTO health_facilities VALUES (1, 'Test', 'Test')");
    await connection.query(fs.readFileSync("database/information_assets.sql", "utf8"));
    await connection.query(fs.readFileSync("database/migrate_purchase_fields.sql", "utf8"));
    await connection.query("CREATE TABLE facility_work_groups (id INT PRIMARY KEY, work_group_name VARCHAR(255)); CREATE TABLE agent_devices (id INT PRIMARY KEY, linked_asset_id INT); INSERT INTO information_asset_surveys (id, facility_id) VALUES (1, 1)");
    const migration = fs.readFileSync("database/add_asset_extensions.sql", "utf8");
    await connection.query(migration);
    await connection.query(migration);
    const [subtypes] = await connection.query("SELECT id FROM asset_subtypes WHERE asset_class = 'Vehicle' LIMIT 1");
    const subtypeId = subtypes[0].id;
    const input = { surveyId: 1, assetName: "Car", assetRegistrationNo: "CAR-1", assetClass: "Vehicle", assetCategory: "Hardware", subtypeId, details: { license_plate: "กข1234", engine_number: "E1" } };
    const { insertId: id } = await repository.createAsset(input);
    assert.equal((await repository.getAssetById(id)).extensions.Vehicle.details.license_plate, "กข1234");
    assert.equal((await repository.listAssets({ search: "กข1234" })).length, 1);
    assert.equal(await repository.countAssets({ search: "กข1234" }), 1);
    await repository.updateAsset(id, { details: { license_plate: "changed" } });
    assert.equal((await repository.getAssetById(id)).extensions.Vehicle.details.engine_number, "E1");
    await repository.updateAsset(id, { assetClass: "Office", details: { material: "wood" }, subtypeId: null });
    let asset = await repository.getAssetById(id);
    assert.equal(asset.extensions.Vehicle.details.license_plate, "changed");
    assert.equal(asset.extensions.Office.details.material, "wood");
    assert.equal((await repository.listAssets({ search: "changed" })).length, 0);
    await repository.updateAsset(id, { assetClass: "Vehicle" });
    await connection.query("UPDATE asset_subtypes SET is_active = 0 WHERE id = ?", [subtypeId]);
    await connection.query(migration);
    assert.equal((await extensions.listAssetSubtypes()).find(s => s.id === subtypeId).isActive, false);
    await repository.updateAsset(id, { subtypeId, details: { odometer_km: "100" } });
    await assert.rejects(repository.createAsset({ ...input, assetRegistrationNo: "CAR-2" }), /ปิดใช้งาน/);
    const [counts] = await connection.query("SELECT COUNT(*) AS n FROM information_assets");
    assert.equal(counts[0].n, 1, "central insert rolls back if extension validation fails");
    await assert.rejects(repository.updateAsset(id, { assetName: "must not persist", details: { odometer_km: "-1" } }));
    assert.equal((await repository.getAssetById(id)).assetName, "Car");
    await assert.rejects(repository.updateAsset(id, { assetRegistrationNo: "x".repeat(500), details: { engine_number: "must rollback" } }));
    assert.equal((await repository.getAssetById(id)).extensions.Vehicle.details.engine_number, "E1", "extension rolls back if central update fails");
    await assert.rejects(connection.query("INSERT INTO asset_extensions VALUES (999, 'Vehicle', NULL, 1, '{}', CURRENT_TIMESTAMP)"));
    await assert.rejects(connection.query("INSERT INTO asset_extensions VALUES (?, 'Other', ?, 1, '{}', CURRENT_TIMESTAMP)", [id, subtypeId]));
    await repository.updateAsset(id, { details: { engine_number: "" } });
    asset = await repository.getAssetById(id);
    assert.equal(asset.extensions.Vehicle.details.engine_number, "");
    await repository.deleteAsset(id);
    const [remaining] = await connection.query("SELECT COUNT(*) AS n FROM asset_extensions");
    assert.equal(remaining[0].n, 0);
  } finally {
    await connection.end();
    await globalState.__atacsMysqlPool.end();
  }
});
