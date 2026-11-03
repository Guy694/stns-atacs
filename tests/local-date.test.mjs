import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

// Production runs with TZ=Asia/Bangkok and MySQL default-time-zone=+07:00.
process.env.TZ = "Asia/Bangkok";

const lib = loadTs("lib/local-date.ts");

test("todayBangkok uses the Bangkok calendar day, not the UTC one", () => {
  // 2026-11-02 01:30 Bangkok = 2026-11-01 18:30 UTC
  assert.equal(lib.todayBangkok(new Date("2026-11-01T18:30:00Z")), "2026-11-02");
  assert.equal(lib.todayBangkok(new Date("2026-11-02T16:59:00Z")), "2026-11-02");
  assert.equal(lib.todayBangkok(new Date("2026-11-02T17:00:00Z")), "2026-11-03");
});

test("dbDate keeps the stored DATE (mysql2 returns local midnight)", () => {
  assert.equal(lib.dbDate(new Date(2026, 9, 1)), "2026-10-01");
  assert.equal(lib.dbDate("2026-10-01"), "2026-10-01");
  assert.equal(lib.dbDate(null), "");
});

test("dbDateTime keeps the stored wall-clock time", () => {
  assert.equal(lib.dbDateTime(new Date(2026, 10, 2, 10, 5, 9)), "2026-11-02 10:05:09");
  assert.equal(lib.dbDateTime("2026-11-02T10:05:09"), "2026-11-02 10:05:09");
  assert.equal(lib.dbDateTime(undefined), "");
});

test("asset rows keep purchase_date on the same day", async () => {
  const repo = loadTs("lib/assets.ts", {
    "@/app/atacs-data": { facilitySurveys: [] },
    "@/lib/mysql": {
      withTransaction: async (w) => w(),
      selectRows: async (sql) => sql.includes("asset_extensions") ? [] : [{ id: 1, survey_id: 1, facility_id: 1, asset_name: "PC", purchase_date: new Date(2026, 9, 1), last_updated_at: new Date(2026, 10, 2) }],
      executeStatement: async () => ({}),
    },
  });
  const asset = await repo.getAssetById(1);
  assert.equal(asset.purchaseDate, "2026-10-01");
  assert.equal(asset.updatedAt, "2026-11-02");
});
