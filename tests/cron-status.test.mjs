import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const cron = loadTs("lib/cron-status.ts", { "@/lib/app-settings": {} });
const NOW = new Date("2026-11-09T12:00:00+07:00");
const minutesAgo = (m) => new Date(NOW.getTime() - m * 60_000).toISOString();

test("M15: a job that never recorded a run is 'never'", () => {
  assert.equal(cron.cronJobHealth(null, NOW, 60), "never");
});

test("M15: a recent successful run is ok, an old one is late (grace = 2x the interval)", () => {
  assert.equal(cron.cronJobHealth({ at: minutesAgo(30), ok: true }, NOW, 60), "ok");
  assert.equal(cron.cronJobHealth({ at: minutesAgo(119), ok: true }, NOW, 60), "ok");
  assert.equal(cron.cronJobHealth({ at: minutesAgo(121), ok: true }, NOW, 60), "late");
});

test("M15: the last run failing is reported even when it is recent", () => {
  assert.equal(cron.cronJobHealth({ at: minutesAgo(5), ok: false }, NOW, 60), "failed");
});

test("M15: stored values are parsed defensively", () => {
  assert.deepEqual({ ...cron.parseCronRun('{"at":"2026-11-09T04:00:00.000Z","ok":true,"detail":"3 เครื่อง"}') }, { at: "2026-11-09T04:00:00.000Z", ok: true, detail: "3 เครื่อง" });
  assert.equal(cron.parseCronRun("not json"), null);
  assert.equal(cron.parseCronRun('{"at":"garbage","ok":true}'), null);
  assert.equal(cron.parseCronRun(null), null);
});

test("M15: every scheduled job has an expected interval", () => {
  const keys = cron.CRON_JOBS.map((job) => job.key);
  assert.deepEqual([...keys].sort(), ["agent-health", "backup-check", "daily-summary"]);
  for (const job of cron.CRON_JOBS) assert.ok(job.everyMinutes > 0 && job.label);
});
