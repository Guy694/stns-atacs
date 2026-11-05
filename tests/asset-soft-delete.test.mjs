import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

/**
 * hasColumn: whether information_assets.deleted_at exists (the information_schema probe answer).
 * openWork: counts returned by the open-work query.
 */
function setup({ hasColumn = true, openWork = {}, lockedAsset = { id: 5, deleted_at: null }, surveys = [] } = {}) {
  const writes = [], reads = [];
  const mysql = {
    withTransaction: async (work) => work(),
    selectRows: async (sql, values) => {
      reads.push({ sql, values });
      if (sql.includes("information_schema.COLUMNS")) return [{ n: hasColumn ? 1 : 0 }];
      if (sql.includes("AS open_repairs")) return [{ open_repairs: 0, open_loans: 0, pending_disposals: 0, ...openWork }];
      if (sql.includes("AS awaiting_execution")) return [{ awaiting_execution: openWork.awaiting_execution ?? 0 }];
      if (sql.includes("FROM information_assets WHERE id = ? FOR UPDATE")) return lockedAsset ? [lockedAsset] : [];
      if (sql.includes("FROM health_facilities WHERE id = ? FOR UPDATE")) return [{ id: 3 }];
      if (sql.includes("FROM information_asset_surveys WHERE facility_id = ?")) return surveys;
      return [];
    },
    executeStatement: async (sql, values) => { writes.push({ sql, values }); return { insertId: 42, affectedRows: 1 }; },
  };
  const repository = loadTs("lib/assets.ts", { "@/app/atacs-data": { facilitySurveys: [] }, "@/lib/mysql": mysql });
  return { repository, writes, reads };
}

const assetQueries = (reads) => reads.filter((read) => !read.sql.includes("information_schema"));

test("list, count, lookup and pickers exclude soft-deleted assets once the column exists", async () => {
  const { repository, reads } = setup();
  await repository.listAssets({});
  await repository.countAssets({ facilityId: 1 });
  await repository.getAssetById(5);
  await repository.listAssetsByIds([5, 6]);
  await repository.listAssetsForFacilityIds([1]);
  await repository.listFacilities();
  const queries = assetQueries(reads).filter((read) => /information_assets/.test(read.sql));
  assert.ok(queries.length >= 6);
  for (const query of queries) assert.match(query.sql, /a\.deleted_at IS NULL/, query.sql);
});

test("before the migration the same queries still run, without referencing deleted_at", async () => {
  const { repository, reads } = setup({ hasColumn: false });
  await repository.listAssets({});
  await repository.countAssets({});
  await repository.getAssetById(5);
  for (const query of assetQueries(reads)) assert.doesNotMatch(query.sql, /deleted_at/);
});

test("the schema probe runs once and is cached", async () => {
  const { repository, reads } = setup();
  await repository.listAssets({});
  await repository.countAssets({});
  await repository.getAssetById(1);
  assert.equal(reads.filter((read) => read.sql.includes("information_schema")).length, 1);
});

test("deleting an asset marks it deleted instead of removing the row", async () => {
  const { repository, writes } = setup();
  await repository.deleteAsset(5, { userId: 9, userName: "Officer" });
  assert.equal(writes.some((write) => /^\s*DELETE/i.test(write.sql)), false);
  const update = writes.find((write) => write.sql.includes("deleted_at = NOW()"));
  assert.ok(update, "soft delete UPDATE");
  assert.deepEqual(Array.from(update.values), [9, "Officer", 5]);
});

test("an asset with open work cannot be deleted", async () => {
  for (const openWork of [{ open_repairs: 1 }, { open_loans: 1 }, { pending_disposals: 1 }, { awaiting_execution: 1 }]) {
    const { repository, writes } = setup({ openWork });
    await assert.rejects(repository.deleteAsset(5, { userId: 9, userName: "Officer" }), /ลบทรัพย์สินไม่ได้/);
    assert.equal(writes.length, 0);
  }
});

test("an already deleted or unknown asset cannot be deleted again", async () => {
  for (const lockedAsset of [null, { id: 5, deleted_at: new Date() }]) {
    const { repository, writes } = setup({ lockedAsset });
    await assert.rejects(repository.deleteAsset(5, { userId: 9, userName: "Officer" }), /ไม่พบทรัพย์สิน/);
    assert.equal(writes.length, 0);
  }
});

test("without the migration deleting is refused rather than falling back to a hard delete", async () => {
  const { repository, writes } = setup({ hasColumn: false });
  await assert.rejects(repository.deleteAsset(5, { userId: 9, userName: "Officer" }), /add_asset_soft_delete\.sql/);
  assert.equal(writes.length, 0);
});

test("updating a soft-deleted asset is refused", async () => {
  const { repository, writes } = setup({ lockedAsset: { id: 5, deleted_at: new Date() } });
  await assert.rejects(repository.updateAsset(5, { assetName: "X" }), /ถูกลบแล้ว/);
  assert.equal(writes.length, 0);
});

test("findOrCreateSurvey serialises on the facility row and reuses the lowest survey id", async () => {
  const existing = setup({ surveys: [{ id: 4 }] });
  assert.equal(await existing.repository.findOrCreateSurvey(3), 4);
  assert.ok(existing.reads.some((read) => read.sql.includes("FROM health_facilities WHERE id = ? FOR UPDATE")));
  assert.match(existing.reads.find((read) => read.sql.includes("FROM information_asset_surveys WHERE facility_id = ?")).sql, /ORDER BY id/);
  assert.equal(existing.writes.length, 0);

  const fresh = setup({ surveys: [] });
  assert.equal(await fresh.repository.findOrCreateSurvey(3), 42);
  assert.equal(fresh.writes.filter((write) => write.sql.includes("INSERT INTO information_asset_surveys")).length, 1);
});

test("createAsset writes the asset and its first status history row in one transaction", async () => {
  let transactions = 0;
  const writes = [];
  const repository = loadTs("lib/assets.ts", {
    "@/app/atacs-data": { facilitySurveys: [] },
    "@/lib/mysql": {
      withTransaction: async (work) => { transactions += 1; return work(); },
      selectRows: async () => [],
      executeStatement: async (sql, values) => { writes.push({ sql, values, transactions }); return { insertId: 7 }; },
    },
  });
  await repository.createAsset(
    { surveyId: 1, assetName: "PC", assetRegistrationNo: null, assetCategory: "Hardware", currentStatus: "Active" },
    { history: { note: "สร้างทะเบียนทรัพย์สิน", changedByUserId: 1, changedBy: "Officer" } }
  );
  const history = writes.find((write) => write.sql.includes("INSERT INTO asset_status_history"));
  assert.ok(history);
  assert.equal(history.values[0], 7);
  assert.equal(transactions, 1);
});
