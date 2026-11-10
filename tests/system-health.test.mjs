import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";
import { stepTarget, formatAlert } from "../scripts/uptime-watchdog.mjs";

const { healthResponse, buildSystemChecks, overallStatus } = loadTs("lib/system-health.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("public /api/health: ok, slow database = degraded (still 200), database down = 503", () => {
  assert.deepEqual(plain(healthResponse({ dbOk: true, dbMs: 12 })), { status: "ok", httpStatus: 200 });
  assert.deepEqual(plain(healthResponse({ dbOk: true, dbMs: 2500 })), { status: "degraded", httpStatus: 200 });
  assert.deepEqual(plain(healthResponse({ dbOk: false, dbMs: null })), { status: "down", httpStatus: 503 });
});

test("admin system checks flag low disk, high memory, failed cron and stale backups", () => {
  const checks = buildSystemChecks({
    db: { ok: true, ms: 8 },
    disk: { freeBytes: 4 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 },
    memory: { rssBytes: 470 * 1024 ** 2, limitBytes: 512 * 1024 ** 2 },
    cron: [{ label: "ตรวจสุขภาพ Agent", health: "ok" }, { label: "สรุปรายวัน", health: "late" }],
    backup: { ageHours: 50, file: "stn_atacs_20261108_023001.sql.gz" },
  });
  const byKey = Object.fromEntries(checks.map((check) => [check.key, check.status]));
  assert.deepEqual(byKey, { db: "ok", disk: "critical", memory: "warning", cron: "warning", backup: "critical" });
  assert.equal(overallStatus(checks), "critical");
});

test("unknown values are warnings, not crashes", () => {
  const checks = buildSystemChecks({ db: { ok: false, ms: null, error: "ECONNREFUSED" }, disk: null, memory: { rssBytes: 100, limitBytes: null }, cron: [], backup: null });
  const byKey = Object.fromEntries(checks.map((check) => [check.key, check.status]));
  assert.equal(byKey.db, "critical");
  assert.equal(byKey.disk, "warning");
  assert.equal(byKey.memory, "ok");
  assert.equal(byKey.backup, "warning");
});

const cfg = { failuresBeforeAlert: 3, remindMs: 30 * 60_000 };
const MIN = 60_000;

test("watchdog alerts only after N consecutive failures, reminds, then reports recovery", () => {
  let state = { failures: 0, downSince: null, alerted: false, lastAlertAt: null };
  const step = (ok, at) => {
    const result = stepTarget(state, { ok, reason: ok ? "" : "HTTP 502" }, at, cfg);
    state = result.state;
    return result.notify?.kind ?? null;
  };
  assert.equal(step(false, 0), null);
  assert.equal(step(false, 1 * MIN), null);
  assert.equal(step(false, 2 * MIN), "down");
  assert.equal(step(false, 3 * MIN), null);
  assert.equal(step(false, 32 * MIN), "still_down");
  assert.equal(step(false, 33 * MIN), null);
  assert.equal(step(true, 40 * MIN), "up");
  assert.equal(state.failures, 0);
  assert.equal(state.alerted, false);
});

test("a single blip never alerts", () => {
  let state = { failures: 0, downSince: null, alerted: false, lastAlertAt: null };
  for (const [ok, at] of [[false, 0], [false, MIN], [true, 2 * MIN], [false, 3 * MIN], [true, 4 * MIN]]) {
    const result = stepTarget(state, { ok, reason: "x" }, at, cfg);
    assert.equal(result.notify, null);
    state = result.state;
  }
});

test("alert text names the system and escapes HTML", () => {
  const text = formatAlert("down", { name: "ATACS <ภายใน>", url: "http://x/api/health/", since: 0, failures: 3, reason: "a<b", now: 3 * MIN });
  assert.match(text, /ATACS/);
  assert.match(text, /&lt;ภายใน&gt;/);
  assert.match(text, /a&lt;b/);
  assert.doesNotMatch(text, /<ภายใน>/);
});
