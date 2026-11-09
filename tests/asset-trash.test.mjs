import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const DELETED = {
  id: 5,
  deleted_at: new Date("2026-11-01T03:00:00Z"),
  asset_registration_no: "7440-001-0001",
  asset_code_prefix: null,
  asset_name: "Notebook",
  serial_number: " SN-1 ",
  asset_class: "IT",
  asset_category: "Hardware",
  facility_id: 3,
};

/**
 * hasColumn: whether information_assets.deleted_at exists.
 * lockedAsset: row returned by the restore lock query.
 * duplicateReg / duplicateSerial: rows returned by the duplicate checks.
 */
function setup({ hasColumn = true, lockedAsset = DELETED, duplicateReg = [], duplicateSerial = [], deletedRows = [] } = {}) {
  const writes = [], reads = [];
  let transactions = 0, inTransaction = false;
  const mysql = {
    withTransaction: async (work) => {
      transactions += 1;
      inTransaction = true;
      try { return await work(); } finally { inTransaction = false; }
    },
    selectRows: async (sql, values) => {
      reads.push({ sql, values, inTransaction });
      if (sql.includes("information_schema.COLUMNS")) return [{ n: hasColumn ? 1 : 0 }];
      if (sql.includes("WHERE a.id = ? FOR UPDATE")) return lockedAsset ? [lockedAsset] : [];
      if (sql.includes("a.asset_registration_no = ?")) return duplicateReg;
      if (sql.includes("TRIM(a.serial_number) = ?")) return duplicateSerial;
      if (sql.includes("a.deleted_at IS NOT NULL")) return deletedRows;
      return [];
    },
    executeStatement: async (sql, values) => { writes.push({ sql, values, inTransaction }); return { insertId: 1, affectedRows: 1 }; },
  };
  const repository = loadTs("lib/assets.ts", {
    "@/app/atacs-data": { facilitySurveys: [] },
    "@/lib/mysql": mysql,
    "@/lib/telegram": { notifyTelegramSafe: async () => {} },
  });
  return { repository, writes, reads, transactions: () => transactions };
}

const actor = { userId: 1, userName: "Admin" };

test("listDeletedAssets returns nothing before the migration and never references deleted_at", async () => {
  const { repository, reads } = setup({ hasColumn: false });
  assert.deepEqual(Array.from(await repository.listDeletedAssets({ limit: 50 })), []);
  assert.equal(reads.some((read) => !read.sql.includes("information_schema") && /deleted_at/.test(read.sql)), false);
});

test("listDeletedAssets lists only deleted rows, newest first, filtered by facility scope and search", async () => {
  const { repository, reads } = setup({
    deletedRows: [{ ...DELETED, facility_name: "รพ.สต.ทดสอบ", district_name: "เมือง", deleted_by: "Officer", deleted_by_user_id: 9 }],
  });
  const rows = await repository.listDeletedAssets({ facilityId: 3, facilityIds: [3, 4], search: "Note", limit: 100000 });
  const query = reads.find((read) => read.sql.includes("a.deleted_at IS NOT NULL"));
  assert.ok(query, "deleted rows query");
  assert.match(query.sql, /ORDER BY a\.deleted_at DESC/);
  assert.match(query.sql, /s\.facility_id = \?/);
  assert.match(query.sql, /s\.facility_id IN \(\?,\?\)/);
  assert.match(query.sql, /LIKE \?/);
  const values = Array.from(query.values);
  assert.ok(values.includes(3) && values.includes(4));
  assert.ok(values.includes("%Note%"));
  assert.equal(values.at(-1), 500, "limit is clamped");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 5);
  assert.equal(rows[0].assetName, "Notebook");
  assert.equal(rows[0].facilityName, "รพ.สต.ทดสอบ");
  assert.equal(rows[0].deletedBy, "Officer");
  assert.equal(rows[0].facilityId, 3);
  assert.ok(rows[0].deletedAt);
});

test("listDeletedAssets with an empty facility scope returns nothing", async () => {
  const { repository, reads } = setup();
  assert.equal((await repository.listDeletedAssets({ facilityIds: [], limit: 50 })).length, 0);
  assert.equal(reads.some((read) => read.sql.includes("a.deleted_at IS NOT NULL")), false);
});

test("restoreAsset clears the deletion and writes an audit row inside one locked transaction", async () => {
  const { repository, writes, reads, transactions } = setup();
  const restored = await repository.restoreAsset(5, actor);
  assert.equal(transactions(), 1);
  assert.ok(reads.find((read) => read.sql.includes("WHERE a.id = ? FOR UPDATE")).inTransaction);
  const update = writes.find((write) => /UPDATE information_assets SET deleted_at = NULL/.test(write.sql));
  assert.ok(update, "restore UPDATE");
  assert.match(update.sql, /deleted_by_user_id = NULL/);
  assert.match(update.sql, /deleted_by = NULL/);
  assert.match(update.sql, /deleted_at IS NOT NULL/);
  assert.deepEqual(Array.from(update.values), [5]);
  const audit = writes.find((write) => write.sql.includes("INSERT INTO audit_logs"));
  assert.ok(audit, "audit row");
  assert.ok(audit.inTransaction && update.inTransaction);
  const [userId, userName, action, entity, entityId, summary] = Array.from(audit.values);
  assert.equal(userId, 1);
  assert.equal(userName, "Admin");
  assert.equal(action, "update");
  assert.equal(entity, "information_assets");
  assert.equal(entityId, 5);
  assert.match(summary, /^กู้คืนทรัพย์สินที่ถูกลบ: /);
  assert.match(summary, /7440-001-0001/);
  assert.match(summary, /Notebook/);
  assert.equal(restored.facilityId, 3);
  assert.equal(restored.assetName, "Notebook");
});

test("restoreAsset is refused before the migration", async () => {
  const { repository, writes } = setup({ hasColumn: false });
  await assert.rejects(repository.restoreAsset(5, actor), /add_asset_soft_delete\.sql/);
  assert.equal(writes.length, 0);
});

test("restoreAsset is refused for an unknown or not-deleted asset", async () => {
  for (const lockedAsset of [null, { ...DELETED, deleted_at: null }]) {
    const { repository, writes } = setup({ lockedAsset });
    await assert.rejects(repository.restoreAsset(5, actor), /ไม่พบทรัพย์สินในถังขยะ/);
    assert.equal(writes.length, 0);
  }
});

test("restoreAsset is refused when an active asset in the facility now uses the same registration number", async () => {
  const { repository, writes, reads } = setup({ duplicateReg: [{ id: 8 }] });
  await assert.rejects(repository.restoreAsset(5, actor), /เลขทะเบียน.*7440-001-0001.*#8/);
  assert.equal(writes.length, 0);
  const check = reads.find((read) => read.sql.includes("a.asset_registration_no = ?"));
  assert.match(check.sql, /a\.deleted_at IS NULL/);
  assert.match(check.sql, /a\.id <> \?/);
  assert.deepEqual(Array.from(check.values), [3, "7440-001-0001", 5]);
});

test("restoreAsset is refused when an active IT hardware asset in the facility now has the same serial number", async () => {
  const { repository, writes, reads } = setup({ duplicateSerial: [{ id: 9 }] });
  await assert.rejects(repository.restoreAsset(5, actor), /Serial Number.*SN-1.*#9/);
  assert.equal(writes.length, 0);
  const check = reads.find((read) => read.sql.includes("TRIM(a.serial_number) = ?"));
  assert.match(check.sql, /a\.deleted_at IS NULL/);
  assert.deepEqual(Array.from(check.values), [3, "SN-1", 5]);
});

test("the serial check only applies to IT hardware", async () => {
  for (const lockedAsset of [{ ...DELETED, asset_class: "MEDICAL" }, { ...DELETED, asset_category: "Software" }, { ...DELETED, serial_number: "  " }]) {
    const { repository, writes, reads } = setup({ lockedAsset, duplicateSerial: [{ id: 9 }] });
    await repository.restoreAsset(5, actor);
    assert.equal(reads.some((read) => read.sql.includes("TRIM(a.serial_number) = ?")), false);
    assert.ok(writes.some((write) => /SET deleted_at = NULL/.test(write.sql)));
  }
});

test("a blank registration number is not checked for duplicates", async () => {
  const { repository, reads } = setup({ lockedAsset: { ...DELETED, asset_registration_no: "  " }, duplicateReg: [{ id: 8 }] });
  await repository.restoreAsset(5, actor);
  assert.equal(reads.some((read) => read.sql.includes("a.asset_registration_no = ?")), false);
});

test("restoreAsset is refused when the actor may not access the asset's facility", async () => {
  const seen = [];
  const { repository, writes } = setup();
  await assert.rejects(
    repository.restoreAsset(5, { ...actor, canAccessFacility: (facilityId) => { seen.push(facilityId); return false; } }),
    /ไม่มีสิทธิ์กู้คืน/
  );
  assert.deepEqual(seen, [3]);
  assert.equal(writes.length, 0);
});
