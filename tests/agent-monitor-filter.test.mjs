import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { filterMonitorRows, normalizeSeverityFilter } = loadTs("lib/agent-monitor-filter.ts");

const row = (id, worst, codes, device = {}) => ({
  device: { id, hostname: `PC-${id}`, operatingSystem: "Microsoft Windows 11 Pro", facilityName: "สสจ.สตูล", ...device },
  worst,
  issues: codes.map((code) => ({ code, severity: worst ?? "info" })),
});

const rows = [
  row(1, null, []), // healthy — must be visible by default (was hidden: production bug)
  row(2, "critical", ["disk-failing"]),
  row(3, "warning", ["disk-low"]),
  row(4, "info", ["agent-outdated"]),
  row(5, "info", ["offline"], { operatingSystem: "Ubuntu 22.04" }),
];
const online = new Map([[1, "online"], [2, "online"], [3, "offline"], [4, "online"], [5, "never"]]);
const ids = (list) => list.map((item) => item.device.id);

test("default view lists every machine, healthy ones included", () => {
  assert.deepEqual(ids(filterMonitorRows(rows, { connectionOf: online })), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(filterMonitorRows(rows, { severity: "all", connectionOf: online })), [1, 2, 3, 4, 5]);
});

test("severity filters", () => {
  assert.deepEqual(ids(filterMonitorRows(rows, { severity: "issues", connectionOf: online })), [2, 3, 5]);
  assert.deepEqual(ids(filterMonitorRows(rows, { severity: "critical", connectionOf: online })), [2]);
  assert.deepEqual(ids(filterMonitorRows(rows, { severity: "warning", connectionOf: online })), [2, 3]);
});

test("connection, OS, issue and text filters", () => {
  assert.deepEqual(ids(filterMonitorRows(rows, { conn: "online", connectionOf: online })), [1, 2, 4]);
  assert.deepEqual(ids(filterMonitorRows(rows, { conn: "offline", connectionOf: online })), [3, 5], "offline includes never-reported");
  assert.deepEqual(ids(filterMonitorRows(rows, { os: "linux-ubuntu", connectionOf: online })), [5]);
  assert.deepEqual(ids(filterMonitorRows(rows, { issue: "agent-outdated", connectionOf: online })), [4]);
  assert.deepEqual(ids(filterMonitorRows(rows, { query: "pc-3", connectionOf: online })), [3]);
});

test("unknown severity values fall back to all", () => {
  assert.equal(normalizeSeverityFilter("bogus"), "");
  assert.equal(normalizeSeverityFilter("all"), "");
  assert.equal(normalizeSeverityFilter("issues"), "issues");
});
