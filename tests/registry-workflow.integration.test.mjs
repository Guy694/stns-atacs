import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import mysql from "mysql2/promise";
import { loadTs } from "./helpers/load-ts.mjs";

// Runs only against an explicitly supplied local MySQL/MariaDB (ATACS_TEST_MYSQL_PORT, e.g. XAMPP or CI).
// It creates and drops its own database (atacs_registry_test) and never touches the application database.
const port = Number(process.env.ATACS_TEST_MYSQL_PORT);
const DB = "atacs_registry_test";

test("registry migrations, loans, disposal execution and inspection found-location against MySQL", { skip: !port }, async () => {
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
  const withAssets = { ...deps, "@/lib/assets": repository };
  const transfers = loadTs("lib/asset-transfers.ts", withAssets);
  const disposals = loadTs("lib/asset-disposals.ts", { ...withAssets, "@/lib/asset-transfers": transfers });
  const loans = loadTs("lib/asset-loans.ts", { ...withAssets, "@/lib/asset-transfers": transfers });
  const inspection = loadTs("lib/inspection.ts", deps);
  const results = loadTs("lib/inspection-results.ts", { ...withAssets, "@/lib/inspection": inspection });
  const one = async (sql, values) => (await connection.query(sql, values))[0][0];
  const run = async (file, times = 1) => {
    const sql = fs.readFileSync(`database/${file}`, "utf8");
    for (let i = 0; i < times; i += 1) await connection.query(sql);
  };

  try {
    await connection.query(`
      CREATE TABLE health_facilities (id INT PRIMARY KEY, name VARCHAR(255), district_name VARCHAR(255));
      INSERT INTO health_facilities VALUES (1, 'รพ.สต.ทดสอบ', 'เมือง'), (2, 'รพ.อื่น', 'ละงู');
      CREATE TABLE facility_work_groups (id INT PRIMARY KEY, facility_id INT, work_group_name VARCHAR(255), is_active TINYINT DEFAULT 1, sort_order INT DEFAULT 0);
      INSERT INTO facility_work_groups (id, facility_id, work_group_name) VALUES (10, 1, 'ไอที'), (11, 1, 'บริการ'), (20, 2, 'อื่น');
      CREATE TABLE agent_devices (id INT PRIMARY KEY, linked_asset_id INT);`);
    await run("information_assets.sql");
    await run("migrate_purchase_fields.sql");
    await run("add_asset_work_group.sql");
    await run("inspection_audit.sql");
    await run("add_inspection_workflow.sql");
    await run("add_inspection_close.sql");
    await run("add_asset_codes_and_inspection_committee.sql");
    await run("add_asset_lifecycle.sql");
    // The newest migrations must be repeatable.
    await run("add_registry_completeness.sql", 2);
    await run("add_inspection_found_location.sql", 2);
    await connection.query("INSERT INTO information_asset_surveys (id, facility_id) VALUES (1, 1), (2, 2)");

    const common = { surveyId: 1, workGroupId: 10, assetClass: "IT", assetCategory: "Hardware", deviceType: "Computer", currentStatus: "Active", purchasePrice: 25000, purchaseDate: "2023-01-15", locationDetail: "ห้อง 1" };
    const { insertId: laptopId } = await repository.createAsset({ ...common, assetName: "Notebook", assetRegistrationNo: "NB-1", fundingSource: "Budget", acquisitionMethod: "EBidding", warrantyEndDate: "2027-01-01" });
    const { insertId: printerId } = await repository.createAsset({ ...common, assetName: "Printer", assetRegistrationNo: "PR-1", deviceType: "Printer" });
    const laptop = await repository.getAssetById(laptopId);
    assert.equal(laptop.fundingSource, "Budget");
    assert.equal(laptop.warrantyEndDate, "2027-01-01");

    // Loans: one open loan per asset; a damaged return marks the asset Broken and blocks new loans.
    const today = new Date().toISOString().slice(0, 10);
    const loanInput = { assetId: laptopId, borrowerName: "นางสาวทดสอบ", purpose: "ออกหน่วยบริการ", loanedOn: today, dueOn: today, userId: 7, userName: "เจ้าหน้าที่" };
    const { loanId } = await loans.createLoan(loanInput);
    await assert.rejects(loans.createLoan(loanInput), /ถูกยืมอยู่แล้ว/);
    const returned = await loans.returnLoan({ loanId, returnedOn: today, condition: "Damaged", note: "จอแตก", userId: 7, userName: "เจ้าหน้าที่" });
    assert.equal(returned.markedBroken, true);
    assert.equal((await repository.getAssetById(laptopId)).currentStatus, "Broken");
    await assert.rejects(loans.createLoan(loanInput), /ชำรุด/);
    await assert.rejects(loans.returnLoan({ loanId, returnedOn: today, condition: "Good", userId: 7, userName: "x" }), /คืนหรือยกเลิกแล้ว/);
    await assert.rejects(connection.query("UPDATE asset_loans SET status = 'Borrowed' WHERE id = ?", [loanId]));

    // Disposal: duplicate pending blocked, no self-approval, execution recorded only after approval.
    const { requestId } = await disposals.createDisposalRequest({ assetId: laptopId, requestType: "Disposed", disposalMethod: "Sale", reason: "ชำรุดเกินซ่อม", eventDate: today, userId: 7, userName: "เจ้าหน้าที่" });
    await assert.rejects(disposals.createDisposalRequest({ assetId: laptopId, requestType: "Lost", reason: "x", eventDate: today, userId: 8, userName: "u" }), /รออนุมัติ/);
    await assert.rejects(disposals.recordDisposalExecution({ requestId, executedOn: today, documentNo: "R-1", proceedsAmount: 500, userId: 9, userName: "ผู้อนุมัติ" }), /อนุมัติแล้ว/);
    await assert.rejects(disposals.decideDisposalRequest({ requestId, decision: "Approved", userId: 7, userName: "เจ้าหน้าที่" }), /ของตนเอง/);
    await disposals.decideDisposalRequest({ requestId, decision: "Approved", approvalDocumentNo: "APP-1", userId: 9, userName: "ผู้อนุมัติ" });
    assert.equal((await disposals.listAwaitingExecution([1])).length, 1);
    await disposals.recordDisposalExecution({ requestId, executedOn: today, documentNo: "R-1", proceedsAmount: 500, userId: 9, userName: "ผู้อนุมัติ" });
    assert.equal((await disposals.listAwaitingExecution([1])).length, 0);
    const executed = await one("SELECT executed_on IS NOT NULL AS done, execution_document_no, proceeds_amount FROM asset_disposal_requests WHERE id = ?", [requestId]);
    assert.equal(executed.done, 1);
    assert.equal(executed.execution_document_no, "R-1");
    assert.equal(Number(executed.proceeds_amount), 500);

    // Inspection: found in another work group → reported, and optionally moved in the register.
    await connection.query("INSERT INTO asset_inspections (id, facility_id, round_name, inspected_by, start_date) VALUES (1, 1, 'ตรวจนับ 2569', 'ทดสอบ', ?)", [today]);
    await connection.query("INSERT INTO asset_inspection_items (id, inspection_id, asset_id, inspection_status) VALUES (1, 1, ?, 'Pending')", [printerId]);
    const officer = { id: 7, fullName: "เจ้าหน้าที่", role: "officer", facilityId: 1 };
    await assert.rejects(results.recordInspectionResult({ ...officer, facilityId: 2 }, { itemId: 1, inspectionStatus: "Found", assetStatus: "Active" }), (error) => error.code === "forbidden");
    await assert.rejects(results.recordInspectionResult(officer, { itemId: 1, inspectionStatus: "Found", assetStatus: "Active", foundWorkGroupId: 20 }), (error) => error.code === "bad-group");
    await assert.rejects(results.recordInspectionResult(officer, { itemId: 1, inspectionStatus: "Found", assetStatus: "Disposed" }), (error) => error.code === "invalid");
    await assert.rejects(results.recordInspectionResult(officer, { itemId: 1, inspectionId: 99, inspectionStatus: "Found", assetStatus: "Active" }), (error) => error.code === "not-found");
    const saved = await results.recordInspectionResult(officer, { itemId: 1, inspectionStatus: "Found", assetStatus: "Active", foundWorkGroupId: 11, foundLocation: "ห้องบัตร", updateRegistry: false });
    assert.equal(saved.moved, true);
    let item = await one("SELECT inspection_status, found_work_group_id, found_location, registered_work_group_id FROM asset_inspection_items WHERE id = 1");
    assert.deepEqual({ ...item }, { inspection_status: "Found", found_work_group_id: 11, found_location: "ห้องบัตร", registered_work_group_id: 10 });
    assert.equal((await repository.getAssetById(printerId)).workGroupId, 10, "without updateRegistry the register keeps its place");
    await results.recordInspectionResult(officer, { itemId: 1, inspectionStatus: "Found", assetStatus: "Broken", foundWorkGroupId: 11, foundLocation: "ห้องบัตร", updateRegistry: true });
    const printer = await repository.getAssetById(printerId);
    assert.equal(printer.workGroupId, 11);
    assert.equal(printer.locationDetail, "ห้องบัตร");
    assert.equal(printer.currentStatus, "Broken");
    const items = await inspection.getInspectionItems(1);
    assert.equal(items[0].foundWorkGroupName, "บริการ");
    assert.equal(items[0].registeredWorkGroupName, "ไอที");
    assert.ok((await one("SELECT COUNT(*) AS n FROM audit_logs WHERE entity = 'asset_inspection_items'")).n >= 2);
    // A closed round rejects further results.
    await connection.query("UPDATE asset_inspections SET round_status = 'Closed' WHERE id = 1");
    await assert.rejects(results.recordInspectionResult(officer, { itemId: 1, inspectionStatus: "Missing", assetStatus: "Active" }), (error) => error.code === "closed");
  } finally {
    await connection.end();
    await globalState.__atacsMysqlPool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.end();
  }
});
