import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import mysql from "mysql2/promise";
import { loadTs } from "./helpers/load-ts.mjs";

// Runs only against an explicitly supplied local MySQL. It creates and drops its own
// database (atacs_lifecycle_test) and never reads .env or touches the application database.
const port = Number(process.env.ATACS_TEST_MYSQL_PORT);
const DB = "atacs_lifecycle_test";

test("lifecycle migration, transfers, approved disposal and repairs against MySQL", { skip: !port }, async () => {
  const base = { host: "127.0.0.1", port, user: process.env.ATACS_TEST_MYSQL_USER || "root", password: process.env.ATACS_TEST_MYSQL_PASSWORD ?? "" };
  const admin = await mysql.createConnection({ ...base, multipleStatements: true });
  await admin.query(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
  const config = { ...base, database: DB, multipleStatements: true };
  const connection = await mysql.createConnection(config);
  const globalState = {};
  const db = loadTs("lib/mysql.ts", { "mysql2/promise": mysql }, { global: globalState, process: { env: { MYSQL_HOST: "127.0.0.1", MYSQL_PORT: String(port), MYSQL_USER: base.user, MYSQL_PASSWORD: base.password || "x", MYSQL_DATABASE: DB } } });
  globalState.__atacsMysqlPool = mysql.createPool({ ...config, multipleStatements: false });
  const deps = { "@/lib/mysql": db, "@/app/atacs-data": { facilitySurveys: [] } };
  const repository = loadTs("lib/assets.ts", deps);
  const lifecycleDeps = { ...deps, "@/lib/assets": repository };
  const transfers = loadTs("lib/asset-transfers.ts", lifecycleDeps);
  const disposals = loadTs("lib/asset-disposals.ts", { ...lifecycleDeps, "@/lib/asset-transfers": transfers });
  const repairs = loadTs("lib/asset-repairs.ts", { ...lifecycleDeps, "@/lib/asset-transfers": transfers });
  const one = async (sql, values) => (await connection.query(sql, values))[0][0];

  try {
    await connection.query(`
      CREATE TABLE health_facilities (id INT PRIMARY KEY, name VARCHAR(255), district_name VARCHAR(255));
      INSERT INTO health_facilities VALUES (1, 'รพ.ต้นทาง', 'เมือง'), (2, 'รพ.สต.ปลายทาง', 'ละงู');
      CREATE TABLE facility_work_groups (id INT PRIMARY KEY, facility_id INT, work_group_name VARCHAR(255), is_active TINYINT DEFAULT 1);
      INSERT INTO facility_work_groups VALUES (10, 1, 'ไอที', 1), (20, 2, 'บริการ', 1);
      CREATE TABLE agent_devices (id INT PRIMARY KEY, linked_asset_id INT);`);
    await connection.query(fs.readFileSync("database/information_assets.sql", "utf8"));
    await connection.query(fs.readFileSync("database/migrate_purchase_fields.sql", "utf8"));
    await connection.query("INSERT INTO information_asset_surveys (id, facility_id) VALUES (1, 1), (2, 2)");
    const migration = fs.readFileSync("database/add_asset_lifecycle.sql", "utf8");
    await connection.query(migration);
    await connection.query(migration); // repeatable

    const base = { surveyId: 1, workGroupId: 10, assetClass: "IT", assetCategory: "Hardware", deviceType: "Printer", currentStatus: "Active", purchasePrice: 30001, purchaseDate: "2024-01-15", maintenanceEndDate: "2027-01-01", usageDescription: "ใช้งานห้องบัตร" };
    const { insertId: printerId } = await repository.createAsset({ ...base, assetName: "Printer", assetRegistrationNo: "PR-1", usefulLifeYears: 4 });
    const { insertId: linkedId } = await repository.createAsset({ ...base, assetName: "PC", assetRegistrationNo: "PC-1", deviceType: "Computer" });
    await connection.query("INSERT INTO agent_devices VALUES (1, ?)", [linkedId]);

    // Useful-life override survives partial updates and can be cleared explicitly.
    await repository.updateAsset(printerId, { assetName: "Printer A" });
    let printer = await repository.getAssetById(printerId);
    assert.equal(printer.usefulLifeYears, 4);
    assert.equal(printer.maintenanceEndDate, "2027-01-01");
    await repository.updateAsset(printerId, { usefulLifeYears: null });
    assert.equal((await repository.getAssetById(printerId)).usefulLifeYears, null);

    // Transfer: new placement + history row + unchanged usage description.
    await assert.rejects(transfers.transferAsset({ assetId: printerId, toSurveyId: 2, transferDate: "2025-01-01", userName: "u" }), /กลุ่มงาน/);
    const moved = await transfers.transferAsset({ assetId: printerId, toSurveyId: 2, toWorkGroupId: 20, toOwnerName: "ผู้ใช้ใหม่", toLocationDetail: "ห้อง 2", reason: "ปรับโครงสร้าง", documentNo: "DOC-1", transferDate: "2025-01-01", userId: 7, userName: "เจ้าหน้าที่" });
    printer = await repository.getAssetById(printerId);
    assert.equal(printer.facilityId, 2);
    assert.equal(printer.workGroupId, 20);
    assert.equal(printer.usageDescription, "ใช้งานห้องบัตร", "transfer must not overwrite usage_description");
    const history = await transfers.listAssetTransfers(printerId);
    assert.equal(history.rows.length, 1);
    assert.equal(history.rows[0].fromFacilityName, "รพ.ต้นทาง");
    assert.equal(history.rows[0].toWorkGroupName, "บริการ");
    assert.equal(moved.toFacilityId, 2);
    assert.equal((await one("SELECT COUNT(*) AS n FROM asset_status_history WHERE asset_id = ?", [printerId])).n, 1);
    // Agent-linked assets cannot change facility, and the failed transfer leaves no history row.
    await assert.rejects(transfers.transferAsset({ assetId: linkedId, toSurveyId: 2, toWorkGroupId: 20, transferDate: "2025-01-01", userName: "u" }), /Agent/);
    assert.equal((await one("SELECT COUNT(*) AS n FROM asset_transfers WHERE asset_id = ?", [linkedId])).n, 0);

    // Repairs: one open job per asset, valid transitions, closing updates asset status.
    const { repairId } = await repairs.createRepair({ assetId: printerId, problem: "กระดาษติด", priority: "High", markBroken: true, userId: 7, userName: "เจ้าหน้าที่" });
    assert.equal((await repository.getAssetById(printerId)).currentStatus, "Broken");
    await assert.rejects(repairs.createRepair({ assetId: printerId, problem: "ซ้ำ", userName: "u" }), /ยังไม่ปิด/);
    await repairs.updateRepair({ repairId, toStatus: "SentToVendor", vendorName: "ร้าน A", cost: 1500, userName: "ช่าง" });
    await assert.rejects(repairs.updateRepair({ repairId, toStatus: "Completed", userName: "ช่าง" }), /ผลการซ่อม/);
    await repairs.updateRepair({ repairId, toStatus: "Completed", resolution: "เปลี่ยนลูกยาง", assetOutcome: "Active", userName: "ช่าง" });
    await assert.rejects(repairs.updateRepair({ repairId, toStatus: "InProgress", userName: "ช่าง" }), /ไม่ได้/);
    const repair = await repairs.getRepair(repairId);
    assert.equal(repair.status, "Completed");
    assert.equal(repair.cost, 1500);
    assert.ok(repair.startedAt && repair.completedAt);
    assert.equal((await repository.getAssetById(printerId)).currentStatus, "Active");
    assert.deepEqual((await repairs.listRepairLogs(repairId)).map(log => log.toStatus), ["Reported", "SentToVendor", "Completed"]);
    const summary = await repairs.summarizeRepairs({ facilityIds: [2] });
    assert.equal(summary.completedCount, 1);
    assert.equal(summary.totalCost, 1500);
    await assert.rejects(connection.query("UPDATE asset_repairs SET cost = -1 WHERE id = ?", [repairId]));

    // Disposal: request → no self-approval → approval sets Disposed and closes open repairs.
    const second = await repairs.createRepair({ assetId: printerId, problem: "เสียอีก", userName: "u" });
    const { requestId } = await disposals.createDisposalRequest({ assetId: printerId, requestType: "Disposed", disposalMethod: "Sale", reason: "ชำรุดเกินคุ้มซ่อม", eventDate: "2025-06-01", bookValue: 5000, userId: 7, userName: "เจ้าหน้าที่" });
    assert.equal((await repository.getAssetById(printerId)).currentStatus, "Active", "a request alone does not change status");
    await assert.rejects(disposals.createDisposalRequest({ assetId: printerId, requestType: "Lost", reason: "x", eventDate: "2025-06-01", userName: "u" }), /รออนุมัติ/);
    await assert.rejects(disposals.createDisposalRequest({ assetId: linkedId, requestType: "Disposed", reason: "x", eventDate: "2025-06-01", userName: "u" }), /วิธีการจำหน่าย/);
    await assert.rejects(disposals.decideDisposalRequest({ requestId, decision: "Approved", userId: 7, userName: "เจ้าหน้าที่" }), /ของตนเอง/);
    await assert.rejects(disposals.decideDisposalRequest({ requestId, decision: "Rejected", userId: 9, userName: "ผู้อนุมัติ" }), /เหตุผล/);
    await disposals.decideDisposalRequest({ requestId, decision: "Approved", approvalDocumentNo: "APP-1", proceedsAmount: 800, userId: 9, userName: "ผู้อนุมัติ" });
    assert.equal((await repository.getAssetById(printerId)).currentStatus, "Disposed");
    assert.equal((await repairs.getRepair(second.repairId)).status, "Cancelled");
    const decided = (await disposals.listDisposalRequests({ assetId: printerId })).rows[0];
    assert.equal(decided.status, "Approved");
    assert.equal(decided.proceedsAmount, 800);
    assert.equal(decided.purchasePrice, 30001);
    await assert.rejects(disposals.decideDisposalRequest({ requestId, decision: "Approved", userId: 9, userName: "x" }), /พิจารณาแล้ว/);
    // Terminal assets reject further lifecycle actions.
    await assert.rejects(transfers.transferAsset({ assetId: printerId, toSurveyId: 1, toWorkGroupId: 10, transferDate: "2025-07-01", userName: "u" }), /จำหน่าย/);
    await assert.rejects(repairs.createRepair({ assetId: printerId, problem: "x", userName: "u" }), /จำหน่าย/);
    assert.equal((await repository.listAssets({ status: "Disposed" })).length, 1);

    // Loss request can be rejected or cancelled and leaves the asset status unchanged.
    const lost = await disposals.createDisposalRequest({ assetId: linkedId, requestType: "Lost", reason: "ไม่พบระหว่างตรวจนับ", eventDate: "2025-06-01", userId: 7, userName: "เจ้าหน้าที่" });
    await disposals.decideDisposalRequest({ requestId: lost.requestId, decision: "Rejected", note: "พบแล้ว", userId: 9, userName: "ผู้อนุมัติ" });
    const retry = await disposals.createDisposalRequest({ assetId: linkedId, requestType: "Lost", reason: "ไม่พบอีกครั้ง", eventDate: "2025-06-02", userId: 7, userName: "เจ้าหน้าที่" });
    await assert.rejects(disposals.cancelDisposalRequest({ requestId: retry.requestId, userId: 8, userName: "คนอื่น", canCancelOthers: false }), /เฉพาะคำขอ/);
    await disposals.cancelDisposalRequest({ requestId: retry.requestId, userId: 7, userName: "เจ้าหน้าที่", canCancelOthers: false });
    assert.equal((await repository.getAssetById(linkedId)).currentStatus, "Active");
    await assert.rejects(connection.query("INSERT INTO asset_disposal_requests (asset_id, facility_id, request_type, reason, event_date) VALUES (?, 1, 'Stolen', 'x', '2025-01-01')", [linkedId]));

    // Deleting an asset cascades its lifecycle rows (the audit log keeps summaries).
    await repository.deleteAsset(printerId);
    for (const table of ["asset_transfers", "asset_repairs", "asset_disposal_requests"]) {
      assert.equal((await one(`SELECT COUNT(*) AS n FROM ${table} WHERE asset_id = ?`, [printerId])).n, 0, table);
    }
  } finally {
    await connection.end();
    await globalState.__atacsMysqlPool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.end();
  }
});
