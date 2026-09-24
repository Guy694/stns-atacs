import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { evaluateBackupHealth } = loadTs("lib/backup-status.ts");

const NOW = Date.UTC(2026, 8, 24, 3, 0, 0);
const hoursAgo = (hours) => NOW - hours * 60 * 60 * 1000;
const dump = (name, hours, bytes = 5_000_000) => ({ name, bytes, modifiedAt: hoursAgo(hours) });

test("healthy when a recent, large enough dump exists alongside older ones", () => {
  const health = evaluateBackupHealth({
    files: [dump("atacs-db-20260924-023000.sql.gz", 1), dump("atacs-db-20260923-023000.sql.gz", 25)],
    status: { state: "ok" },
    now: NOW,
  });
  assert.equal(health.level, "ok");
  assert.equal(health.problems.length, 0);
  assert.equal(health.latestDatabaseFile, "atacs-db-20260924-023000.sql.gz");
  assert.equal(health.latestDatabaseAgeHours, 1);
});

test("critical when there is no dump at all", () => {
  const health = evaluateBackupHealth({ files: [], now: NOW });
  assert.equal(health.level, "critical");
  assert.match(health.problems.join(" "), /ไม่พบไฟล์สำรอง/);
});

test("critical when the newest dump is stale, tiny, or the run reported failure", () => {
  const stale = evaluateBackupHealth({ files: [dump("atacs-db-1.sql.gz", 50), dump("atacs-db-2.sql.gz", 74)], now: NOW });
  assert.equal(stale.level, "critical");

  const tiny = evaluateBackupHealth({ files: [dump("atacs-db-1.sql.gz", 1, 100), dump("atacs-db-2.sql.gz", 25)], now: NOW });
  assert.equal(tiny.level, "critical");

  const failed = evaluateBackupHealth({
    files: [dump("atacs-db-1.sql.gz", 1), dump("atacs-db-2.sql.gz", 25)],
    status: { state: "failed", message: "mariadb-dump ล้มเหลว" },
    now: NOW,
  });
  assert.equal(failed.level, "critical");
  assert.match(failed.problems.join(" "), /mariadb-dump/);
});

test("warns about rejected files and a single copy without calling it critical", () => {
  const health = evaluateBackupHealth({
    files: [dump("atacs-db-1.sql.gz", 1), dump("atacs-db-2.sql.gz.bad", 2)],
    status: { state: "ok" },
    now: NOW,
  });
  assert.equal(health.level, "warning");
  assert.equal(health.badFileCount, 1);
  assert.equal(health.problems.length, 2);
});
