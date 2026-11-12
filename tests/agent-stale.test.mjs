import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { staleAgentDays, findStaleAgents } = loadTs("lib/agent-stale.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("threshold defaults to 60 days, never below 14", () => {
  assert.equal(staleAgentDays({}), 60);
  assert.equal(staleAgentDays({ AGENT_STALE_DAYS: "90" }), 90);
  assert.equal(staleAgentDays({ AGENT_STALE_DAYS: "3" }), 60);
  assert.equal(staleAgentDays({ AGENT_STALE_DAYS: "abc" }), 60);
});

test("finds in-service machines silent for too long, oldest first", () => {
  const now = Date.parse("2026-11-11T12:00:00+07:00");
  const device = (id, last, extra = {}) => ({
    id,
    hostname: `PC-${id}`,
    facilityName: "รพ.สตูล",
    agentVersion: "1.0.0",
    isActive: true,
    uninstallRequestedAt: null,
    uninstalledAt: null,
    lastReportedAt: last,
    lastSeenAt: last,
    firstSeenAt: "2026-01-01T08:00:00+07:00",
    ...extra,
  });
  const rows = findStaleAgents(
    [
      device(1, "2026-11-10T08:00:00+07:00"), // 1 day
      device(2, "2026-08-23T09:00:00+07:00"), // 80 days
      device(3, "2026-09-01T09:00:00+07:00"), // 71 days
      device(4, "2026-01-01T09:00:00+07:00", { isActive: false }), // retired already
      device(5, null, { lastSeenAt: null, firstSeenAt: "2026-07-01T09:00:00+07:00" }), // never reported
      device(6, "2026-01-01T09:00:00+07:00", { uninstallRequestedAt: "2026-02-01T09:00:00+07:00" }), // pending: still in service
    ],
    now,
    60
  );
  assert.deepEqual(plain(rows.map((row) => [row.id, row.daysSilent, row.selfUninstall])), [
    [6, 314, false],
    [5, 133, false],
    [2, 80, false],
    [3, 71, false],
  ]);
  assert.equal(findStaleAgents([device(7, "2026-08-23T09:00:00+07:00", { agentVersion: "2.2.0" })], now, 60)[0].selfUninstall, true);
});
