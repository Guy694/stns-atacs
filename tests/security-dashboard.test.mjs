import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { describeSecurityEvent, buildDailySeries, summarizeSecurityKpis, SECURITY_EVENT_GROUPS, eventTypesForGroup } =
  loadTs("lib/security-dashboard.ts");
// loadTs runs the module in its own VM context: compare as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("known events get a Thai label, group, tone and suspicious flag", () => {
  assert.deepEqual(plain(describeSecurityEvent("login_succeeded")), {
    type: "login_succeeded", label: "เข้าสู่ระบบสำเร็จ", group: "login", tone: "success", suspicious: false,
  });
  const failed = describeSecurityEvent("login_failed_password");
  assert.equal(failed.group, "login");
  assert.equal(failed.suspicious, true);
  assert.equal(describeSecurityEvent("login_locked_out").tone, "danger");
  assert.equal(describeSecurityEvent("agent_invalid_credentials").group, "agent");
  assert.equal(describeSecurityEvent("agent_retired").suspicious, false, "routine lifecycle event");
  assert.equal(describeSecurityEvent("cron_unauthorized").group, "system");
  assert.equal(describeSecurityEvent("thaid_oauth_state_mismatch").group, "external-login");
  assert.equal(describeSecurityEvent("google_login_failed").group, "external-login");
});

test("unknown event types still render", () => {
  assert.deepEqual(plain(describeSecurityEvent("something_new")), {
    type: "something_new", label: "something_new", group: "other", tone: "info", suspicious: false,
  });
});

test("every group has a label and lists its event types", () => {
  for (const group of SECURITY_EVENT_GROUPS) assert.ok(group.label, group.key);
  assert.ok(eventTypesForGroup("login").includes("login_failed_password"));
  assert.ok(!eventTypesForGroup("login").includes("agent_retired"));
  assert.deepEqual(plain(eventTypesForGroup("nope")), []);
});

test("daily series fills missing days with zeros, oldest first, split by outcome", () => {
  const rows = [
    { day: "2026-11-08", eventType: "login_failed_password", total: 4 },
    { day: "2026-11-08", eventType: "login_succeeded", total: 2 },
    { day: "2026-11-10", eventType: "agent_invalid_credentials", total: 3 },
    { day: "2026-11-10", eventType: "agent_retired", total: 9 }, // routine → "other"
    { day: "2026-10-01", eventType: "login_succeeded", total: 50 }, // outside window → ignored
  ];
  const series = buildDailySeries(rows, { days: 3, today: "2026-11-10" });
  assert.deepEqual(plain(series), [
    { day: "2026-11-08", success: 2, failed: 4, suspicious: 0, other: 0 },
    { day: "2026-11-09", success: 0, failed: 0, suspicious: 0, other: 0 },
    { day: "2026-11-10", success: 0, failed: 0, suspicious: 3, other: 9 },
  ]);
});

test("daily series crosses month boundaries", () => {
  const series = buildDailySeries([], { days: 3, today: "2026-03-01" });
  assert.deepEqual(plain(series.map((d) => d.day)), ["2026-02-27", "2026-02-28", "2026-03-01"]);
});

test("KPIs for a window", () => {
  const kpi = summarizeSecurityKpis([
    { eventType: "login_succeeded", total: 10, ips: 3 },
    { eventType: "login_failed_password", total: 7, ips: 4 },
    { eventType: "login_locked_out", total: 1, ips: 1 },
    { eventType: "agent_invalid_credentials", total: 5, ips: 2 },
    { eventType: "agent_retired", total: 2, ips: 1 },
  ]);
  assert.deepEqual(plain(kpi), { loginSuccess: 10, loginFailed: 7, lockouts: 1, suspicious: 13, total: 25 });
});
