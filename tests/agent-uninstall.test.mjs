import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const uninstall = loadTs("lib/agent-uninstall.ts");

// ---------------------------------------------------------------- eligibility (pure)

test("lifecycle: active, pending, uninstalled (with date) and retired", () => {
  assert.equal(uninstall.agentLifecycleState({ isActive: true }), "active");
  assert.equal(uninstall.agentLifecycleState({ isActive: true, uninstallRequestedAt: "2026-11-05T09:00:00+07:00" }), "uninstall-pending");
  assert.equal(uninstall.agentLifecycleState({ isActive: false, uninstallRequestedAt: "x", uninstalledAt: "2026-11-05T10:00:00+07:00" }), "uninstalled");
  assert.equal(uninstall.agentLifecycleState({ isActive: false }), "retired");
  assert.equal(uninstall.AGENT_LIFECYCLE_LABELS["uninstall-pending"], "รอถอนการติดตั้ง");
  assert.equal(uninstall.AGENT_LIFECYCLE_LABELS.uninstalled, "ถอนการติดตั้งแล้ว");
  assert.equal(uninstall.AGENT_LIFECYCLE_LABELS.retired, "ลบออกจากระบบแล้ว");
  assert.equal(uninstall.isAgentDeviceInService({ isActive: true, uninstallRequestedAt: "x" }), true, "pending is still installed");
  assert.equal(uninstall.isAgentDeviceInService({ isActive: false }), false);
  assert.equal(uninstall.isAgentDeviceInService({ isActive: false, uninstalledAt: "x" }), false);
});

test("uninstall instruction only for a pending request from an agent with the self-uninstall capability", () => {
  const at = "2026-11-05T09:00:00+07:00";
  const decide = (patch) => plain(uninstall.decideAgentUninstall({ isActive: true, uninstallRequestedAt: at, uninstalledAt: null, capabilities: ["self-update", "self-uninstall"], ...patch }));
  assert.deepEqual(decide({}), { uninstall: { requestedAt: at }, reason: "requested" });
  assert.deepEqual(decide({ capabilities: ["self-update"] }), { uninstall: null, reason: "no-capability" }, "2.2.0 without the flag / old agents");
  assert.deepEqual(decide({ capabilities: undefined }), { uninstall: null, reason: "no-capability" }, "2.0.x/2.1.0 send no capabilities");
  assert.deepEqual(decide({ capabilities: ["SELF-UNINSTALL "] }), { uninstall: { requestedAt: at }, reason: "requested" }, "normalised like other capabilities");
  assert.deepEqual(decide({ uninstallRequestedAt: null }), { uninstall: null, reason: "not-requested" }, "cancelled request");
  assert.deepEqual(decide({ isActive: false }), { uninstall: null, reason: "inactive" }, "retired");
  assert.deepEqual(decide({ uninstalledAt: at }), { uninstall: null, reason: "inactive" }, "already uninstalled");
});

test("UI version hint and confirmation rules", () => {
  assert.equal(uninstall.agentVersionSupportsSelfUninstall("2.2.0"), true);
  assert.equal(uninstall.agentVersionSupportsSelfUninstall("2.10.1"), true);
  assert.equal(uninstall.agentVersionSupportsSelfUninstall("2.1.0"), false);
  assert.equal(uninstall.agentVersionSupportsSelfUninstall("2.0.3"), false);
  assert.equal(uninstall.agentVersionSupportsSelfUninstall(null), false);
  assert.equal(uninstall.agentVersionSupportsSelfUninstall("abc"), false);

  assert.equal(uninstall.parseAgentUninstalledBody({ reason: "manual" }).reason, "manual");
  assert.equal(uninstall.parseAgentUninstalledBody({ reason: "evil" }).reason, "remote");
  assert.equal(uninstall.parseAgentUninstalledBody(null).reason, "remote");

  const pending = { isActive: true, uninstallRequestedAt: "x" };
  assert.equal(uninstall.decideAgentUninstallConfirmation(pending, "remote"), "confirm");
  assert.equal(uninstall.decideAgentUninstallConfirmation({ isActive: true }, "remote"), "not-requested", "admin cancelled before the agent confirmed");
  assert.equal(uninstall.decideAgentUninstallConfirmation({ isActive: true }, "manual"), "confirm", "manual script may always mark it");
  assert.equal(uninstall.decideAgentUninstallConfirmation({ isActive: false }, "manual"), "inactive");
});

// ---------------------------------------------------------------- lib/agent.ts with a mocked database

function agentHarness({ device = {}, columns = true, previousRevoked = null, affectedRows = 1 } = {}) {
  const writes = [], reads = [], assetWrites = [];
  const row = {
    id: 5, facility_id: 10, facility_name: "รพ.สต.A", agent_uuid: "agent-5", device_fingerprint: "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a", agent_key_hash: "h",
    hostname: "PC-5", agent_version: "2.2.0", linked_asset_id: 7, status: "online", is_active: 1,
    ...(columns ? { uninstall_requested_at: null, uninstall_requested_by: null, uninstalled_at: null } : {}),
    ...device,
  };
  const missingColumn = () => Object.assign(new Error("Unknown column 'uninstalled_at'"), { code: "ER_BAD_FIELD_ERROR" });
  const agent = loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": {
      findOrCreateSurvey: async () => 99,
      createAsset: async (input) => { assetWrites.push(["create", input]); return { insertId: 8 }; },
      updateAsset: async (id, input) => { assetWrites.push(["update", id, input]); },
    },
    "@/lib/mysql": {
      executeStatement: async (sql, values) => {
        if (!columns && /uninstall/.test(sql)) throw missingColumn();
        writes.push({ sql, values });
        return { insertId: 1, affectedRows };
      },
      selectRows: async (sql, values) => {
        reads.push({ sql, values });
        if (!columns && /uninstall/.test(sql)) throw missingColumn();
        if (sql.includes("information_schema.COLUMNS")) return [{ total: 0 }];
        if (sql.includes("WHERE ad.agent_uuid = ?") && sql.includes("ad.agent_key_hash = ?")) return row.is_active === 1 ? [row] : [];
        if (sql.includes("agent_key_hash = ? AND is_active = 0")) return previousRevoked ? [previousRevoked] : [];
        if (sql.includes("SELECT id, is_active, uninstall_requested_at")) return [row];
        if (sql.includes("SELECT is_active FROM agent_devices WHERE agent_uuid")) return [{ is_active: row.is_active }];
        if (sql.includes("WHERE ad.facility_id = ? AND ad.device_fingerprint = ?")) return [row];
        if (sql.includes("FROM agent_devices ad")) return [row];
        if (sql.includes("FROM information_assets")) return [{ id: 7, survey_id: 99, asset_class: "IT", asset_category: "Hardware", device_type: "Desktop", facility_id: 10, current_status: "Active" }];
        return [];
      },
    },
  });
  const report = (payload = {}) => agent.reportAgentInventory({
    agentId: "agent-5", agentKey: "secret-key",
    payload: { fingerprint: "a".repeat(64), hostname: "PC-5", deviceType: "Desktop", agentVersion: "2.2.0", capabilities: ["self-update", "self-uninstall"], ...payload },
  });
  return { agent, report, writes, reads, assetWrites, row };
}

test("report: pending request + capability returns uninstall and skips asset linking", async () => {
  const ctx = agentHarness({ device: { uninstall_requested_at: "2026-11-05 09:00:00", uninstall_requested_by: "Admin" } });
  const result = await ctx.report();
  assert.deepEqual(plain(result.uninstall), { requestedAt: "2026-11-05T09:00:00+07:00" });
  assert.equal(ctx.assetWrites.length, 0, "no asset create/update for a machine being uninstalled");
  assert.ok(ctx.writes.some((w) => /last_reported_at = NOW\(\)/.test(w.sql)), "the report itself is still recorded");
});

test("report: old agent (no capability) keeps the request pending and reports normally", async () => {
  const ctx = agentHarness({ device: { uninstall_requested_at: "2026-11-05 09:00:00", agent_version: "2.1.0" } });
  const result = await ctx.report({ agentVersion: "2.1.0", capabilities: undefined });
  assert.equal(result.uninstall, null);
  assert.ok(ctx.assetWrites.length > 0);
});

test("report: no request -> uninstall null", async () => {
  const result = await agentHarness().report();
  assert.equal(result.uninstall, null);
});

test("admin request / cancel / retire SQL and migration fallback", async () => {
  let ctx = agentHarness();
  assert.equal(await ctx.agent.requestAgentUninstall(5, "Admin A"), "requested");
  const request = ctx.writes.find((w) => /SET uninstall_requested_at = NOW\(\)/.test(w.sql));
  assert.ok(request, "request writes NOW()");
  assert.deepEqual(plain(request.values), ["Admin A", 5]);
  assert.match(request.sql, /is_active = 1 AND uninstalled_at IS NULL AND uninstall_requested_at IS NULL/);

  ctx = agentHarness({ device: { uninstall_requested_at: "2026-11-05 09:00:00" } });
  assert.equal(await ctx.agent.requestAgentUninstall(5, "Admin"), "already-pending");
  assert.equal(await ctx.agent.cancelAgentUninstall(5), "cancelled");
  assert.ok(ctx.writes.some((w) => /SET uninstall_requested_at = NULL, uninstall_requested_by = NULL/.test(w.sql)));

  ctx = agentHarness();
  assert.equal(await ctx.agent.cancelAgentUninstall(5), "not-pending");
  ctx = agentHarness({ device: { is_active: 0 } });
  assert.equal(await ctx.agent.requestAgentUninstall(5, "Admin"), "inactive");

  ctx = agentHarness({ columns: false });
  await assert.rejects(ctx.agent.requestAgentUninstall(5, "Admin"), (error) => error.message === "AGENT_UNINSTALL_MIGRATION_REQUIRED");
  await assert.rejects(ctx.agent.cancelAgentUninstall(5), (error) => error.name === "AgentUninstallMigrationError");
  const { AGENT_UNINSTALL_MIGRATION_MESSAGE } = uninstall;
  assert.match(AGENT_UNINSTALL_MIGRATION_MESSAGE, /database\/add_agent_uninstall\.sql/);

  // retire works without the migration: revoke the key + inactive, history kept (no DELETE)
  ctx = agentHarness({ columns: false });
  assert.equal(await ctx.agent.retireAgentDevice(5), "retired");
  const retire = ctx.writes.find((w) => /SET is_active = 0, status = 'offline', agent_key_hash = \?/.test(w.sql));
  assert.ok(retire);
  assert.match(retire.values[0], /^[0-9a-f]{64}$/);
  assert.notEqual(retire.values[0], ctx.row.agent_key_hash);
  assert.ok(!ctx.writes.some((w) => /DELETE/.test(w.sql)));
  assert.equal(await agentHarness({ affectedRows: 0 }).agent.retireAgentDevice(5), "already-inactive");
});

test("uninstalled: confirm revokes the key, records uninstalled_at; retry with the same key is idempotent", async () => {
  const crypto = await import("node:crypto");
  const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
  const ctx = agentHarness({ device: { uninstall_requested_at: "2026-11-05 09:00:00", uninstall_requested_by: "Admin A", agent_key_hash: sha("secret-key") } });
  const result = plain(await ctx.agent.confirmAgentUninstalled({ agentId: "agent-5", agentKey: "secret-key", reason: "remote" }));
  assert.equal(result.outcome, "confirmed");
  assert.equal(result.requestedBy, "Admin A");
  const update = ctx.writes.find((w) => /uninstalled_at = NOW\(\)/.test(w.sql));
  assert.ok(update);
  assert.match(update.sql, /is_active = 0/);
  assert.match(update.sql, /WHERE id = \? AND agent_key_hash = \?/);
  const revoked = sha(`uninstalled:${sha("secret-key")}`);
  assert.deepEqual(plain(update.values), [revoked, 5, sha("secret-key")], "new hash never matches the plain key");

  // the agent's first answer was lost: same key again -> already, not 401
  const again = agentHarness({ device: { is_active: 0, agent_key_hash: revoked }, previousRevoked: { id: 5 } });
  assert.deepEqual(plain(await again.agent.confirmAgentUninstalled({ agentId: "agent-5", agentKey: "secret-key", reason: "remote" })), { outcome: "already", deviceId: 5 });
  assert.deepEqual(plain(again.reads.find((r) => r.sql.includes("is_active = 0")).values), ["agent-5", revoked]);

  // wrong key / retired (random key) -> invalid
  assert.deepEqual(plain(await agentHarness({ device: { is_active: 0 } }).agent.confirmAgentUninstalled({ agentId: "agent-5", agentKey: "other", reason: "remote" })), { outcome: "invalid" });
  // cancelled before the agent confirmed
  assert.equal((await agentHarness().agent.confirmAgentUninstalled({ agentId: "agent-5", agentKey: "secret-key", reason: "remote" })).outcome, "not-requested");
  // manual script before the migration: still revokes the key
  const manual = agentHarness({ columns: false });
  assert.equal((await manual.agent.confirmAgentUninstalled({ agentId: "agent-5", agentKey: "secret-key", reason: "manual" })).outcome, "confirmed");
  assert.ok(manual.writes.some((w) => /SET is_active = 0, status = 'offline', agent_key_hash = \?\s+WHERE id = \? AND agent_key_hash = \?/.test(w.sql)));
});

test("re-enrolling a previously uninstalled machine clears the old request", async () => {
  const ctx = agentHarness({ device: { is_active: 0, uninstall_requested_at: "2026-11-05 09:00:00", uninstalled_at: "2026-11-05 10:00:00" } });
  // enrollAgentDevice needs an enrollment row: reuse the generic selectRows mock path
  const enrollment = { id: 3, facility_id: 10, facility_name: "รพ.สต.A", work_group_id: null, work_group_name: null };
  const agent = loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": {},
    "@/lib/mysql": {
      executeStatement: async (sql, values) => { ctx.writes.push({ sql, values }); return { insertId: 1, affectedRows: 1 }; },
      selectRows: async (sql) => (sql.includes("FROM agent_enrollments ae") ? [enrollment] : [ctx.row]),
    },
  });
  await agent.enrollAgentDevice({ enrollmentToken: "tok", fingerprint: "b".repeat(64), hostname: "PC-5", agentVersion: "2.2.0" });
  assert.ok(ctx.writes.some((w) => /SET uninstall_requested_at = NULL, uninstall_requested_by = NULL, uninstalled_at = NULL/.test(w.sql)));
});

test("cron agent-health: offline alerts skip uninstalled devices, and still work before the migration", async () => {
  let ctx = agentHarness();
  await ctx.agent.findOfflineAgentDevices(300);
  const select = ctx.reads.find((r) => /DATE_SUB\(NOW\(\), INTERVAL \? MINUTE\)/.test(r.sql));
  assert.match(select.sql, /ad\.is_active = 1\s+AND ad\.uninstalled_at IS NULL/);
  const update = ctx.writes.find((w) => /SET status = 'offline'/.test(w.sql));
  assert.match(update.sql, /is_active = 1\s+AND uninstalled_at IS NULL/);

  ctx = agentHarness({ columns: false });
  const devices = await ctx.agent.findOfflineAgentDevices(300);
  assert.equal(devices.length, 1);
  assert.ok(!ctx.writes.find((w) => /SET status = 'offline'/.test(w.sql)).sql.includes("uninstalled_at"));
});

// ---------------------------------------------------------------- summary exclusion

test("dashboard KPIs exclude uninstalled/retired devices and count them separately", () => {
  const summary = loadTs("lib/agent-monitor-summary.ts");
  const now = new Date("2026-11-05T03:00:00Z");
  const base = { facilityId: 1, facilityName: "A", lastSeenAt: "2026-11-05T09:30:00+07:00", status: "online", operatingSystem: "Windows 11 Pro", agentVersion: "2.2.0" };
  const fleet = summary.summarizeAgentFleet([
    base,
    { ...base, isActive: true, uninstallRequestedAt: "2026-11-05T09:00:00+07:00" },
    { ...base, isActive: false, lastSeenAt: "2026-01-01T09:00:00+07:00" },
    { ...base, isActive: false, uninstalledAt: "2026-11-05T10:00:00+07:00", lastSeenAt: null },
  ], { now, latestVersion: "2.2.0", offlineMinutes: 300 });
  assert.equal(fleet.total, 2);
  assert.equal(fleet.retired, 2);
  assert.equal(fleet.uninstallPending, 1);
  assert.deepEqual(plain(fleet.connection), { online: 2, offline: 0, never: 0 });
  assert.deepEqual(plain(fleet.facilitiesByOffline), []);

  const health = loadTs("lib/agent-health.ts");
  const monitor = health.summarizeAgentMonitor([
    { id: 1, isActive: true, lastSeenAt: base.lastSeenAt, operatingSystem: "Windows 11", ramMb: 8192, agentVersion: "2.2.0", serialNumber: "S", diskTotalGb: null, diskFreeGb: null },
    { id: 2, isActive: true, uninstalledAt: "2026-11-05T10:00:00+07:00", lastSeenAt: null, operatingSystem: null, ramMb: null, agentVersion: null, serialNumber: null, diskTotalGb: null, diskFreeGb: null },
    { id: 3, isActive: false, lastSeenAt: null, operatingSystem: null, ramMb: null, agentVersion: null, serialNumber: null, diskTotalGb: null, diskFreeGb: null },
  ], now);
  assert.deepEqual(plain(monitor.rows.map((row) => row.device.id)), [1]);

  const update = loadTs("lib/agent-update.ts");
  const fleetUpdate = update.summarizeAgentUpdateFleet([
    { facilityId: 1, agentVersion: "2.1.0", isActive: true },
    { facilityId: 1, agentVersion: "2.1.0", isActive: true, uninstalledAt: "x" },
    { facilityId: 1, agentVersion: "2.1.0", isActive: false },
  ], { mode: "off", pilotFacilityIds: [] }, "2.2.0");
  assert.equal(fleetUpdate.total, 1);
});

// ---------------------------------------------------------------- routes

function routeRequest(url, { headers = {}, body } = {}) {
  const request = new Request(url, { method: "POST", headers, body });
  return Object.assign(request, { nextUrl: new URL(url) });
}

const nextServer = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } };

function uninstalledRoute(confirm) {
  const events = [], alerts = [], calls = [];
  const route = loadTs("app/api/agent/uninstalled/route.ts", {
    "next/server": nextServer,
    "@/lib/agent": { confirmAgentUninstalled: async (input) => { calls.push(input); return confirm(input); } },
    "@/lib/telegram": { notifyTelegramSafe: async (input) => { alerts.push(input); return { sent: true }; } },
    "@/lib/security": { readRequestIp: () => "10.0.0.9", recordSecurityEvent: async (input) => { events.push(input); } },
  });
  const post = (options) => route.POST(routeRequest("https://stn.moph.go.th/stns-atacs/api/agent/uninstalled/", options));
  return { post, events, alerts, calls };
}

const creds = { "x-agent-id": "agent-5", "x-agent-key": "secret-key" };

test("POST /api/agent/uninstalled/: auth, body cap, outcomes and alerts", async () => {
  let ctx = uninstalledRoute(() => assert.fail("must not be called"));
  assert.equal((await ctx.post({})).status, 401, "missing credentials");
  assert.equal((await ctx.post({ headers: creds, body: "x".repeat(5000) })).status, 413, "small body cap");
  assert.equal((await ctx.post({ headers: creds, body: "{nope" })).status, 400);
  assert.equal((await ctx.post({ headers: creds, body: "[1]" })).status, 400);

  ctx = uninstalledRoute(() => ({ outcome: "invalid" }));
  assert.equal((await ctx.post({ headers: creds })).status, 401);
  assert.equal(ctx.events[0].eventType, "agent_invalid_credentials");

  ctx = uninstalledRoute(() => ({ outcome: "not-requested", deviceId: 5 }));
  const conflict = await ctx.post({ headers: creds, body: JSON.stringify({ reason: "remote" }) });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, "UNINSTALL_NOT_REQUESTED");

  ctx = uninstalledRoute(() => ({ outcome: "already", deviceId: 5 }));
  const already = await ctx.post({ headers: creds });
  assert.deepEqual(plain(already), { body: { ok: true, uninstalled: true, alreadyUninstalled: true, deviceId: 5 }, status: 200 });
  assert.equal(ctx.alerts.length, 0, "no duplicate alert on retry");

  ctx = uninstalledRoute((input) => ({
    outcome: "confirmed", deviceId: 5, hostname: "PC-5", facilityName: "รพ.สต.A", agentUuid: "agent-5", agentVersion: "2.2.0",
    requestedAt: "2026-11-05T09:00:00+07:00", requestedBy: "Admin A", reason: input.reason,
  }));
  const ok = await ctx.post({ headers: creds, body: JSON.stringify({ reason: "manual" }) });
  assert.deepEqual(plain(ok), { body: { ok: true, uninstalled: true, deviceId: 5 }, status: 200 });
  assert.equal(ctx.calls[0].reason, "manual");
  assert.equal(ctx.events[0].eventType, "agent_uninstalled");
  assert.equal(ctx.alerts.length, 1);
  assert.match(ctx.alerts[0].eventKey, /^agent-uninstalled:5:/);
});

function reportRoute(result, { retired = false } = {}) {
  const events = [], alerts = [];
  let updateChecked = false;
  const route = loadTs("app/api/agent/report/route.ts", {
    "next/server": nextServer,
    "@/lib/agent": {
      AgentLinkedAssetError: class extends Error {},
      isRetiredAgentUuid: async () => retired,
      reportAgentInventory: async () => { if (!result) throw new Error("INVALID_AGENT_CREDENTIALS"); return result; },
    },
    "@/lib/agent-api-base": { announcedApiBaseUrl: () => null },
    "@/lib/agent-install": { AGENT_INSTALL_API_BASE_URL: "https://stn.moph.go.th/stns-atacs" },
    "@/lib/agent-update": { resolveAgentUpdateOffer: async () => { updateChecked = true; return { update: { version: "9.9.9" }, reason: "offered" }; } },
    "@/lib/app-settings": { getAgentAutoUpdateSettings: async () => ({ mode: "all", pilotFacilityIds: [] }) },
    "@/lib/telegram": { notifyTelegramSafe: async (input) => { alerts.push(input); return { sent: true }; } },
    "@/lib/security": { readRequestIp: () => "10.0.0.9", recordSecurityEvent: async (input) => { events.push(input); } },
  });
  const post = () => route.POST(routeRequest("https://stn.moph.go.th/stns-atacs/api/agent/report/", {
    headers: creds, body: JSON.stringify({ fingerprint: "fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa", capabilities: ["self-update", "self-uninstall"] }),
  }));
  return { post, events, alerts, wasUpdateChecked: () => updateChecked };
}

test("POST /api/agent/report/: response shape with uninstall, and quiet 401 for retired agents", async () => {
  const base = { deviceId: 5, facilityId: 10, recovered: false, hostname: "PC-5", facilityName: "A", agentUuid: "agent-5", linkedAssetId: 7, surveyId: null };
  let ctx = reportRoute({ ...base, uninstall: { requestedAt: "2026-11-05T09:00:00+07:00" } });
  let response = await ctx.post();
  assert.equal(response.status, 200);
  assert.deepEqual(plain(response.body.uninstall), { requestedAt: "2026-11-05T09:00:00+07:00" });
  assert.equal(response.body.update, undefined, "no update offered while uninstalling");
  assert.equal(ctx.wasUpdateChecked(), false);

  ctx = reportRoute({ ...base, uninstall: null });
  response = await ctx.post();
  assert.equal("uninstall" in response.body, false, "no uninstall key normally");
  assert.equal(response.body.update.version, "9.9.9");

  ctx = reportRoute(null, { retired: true });
  response = await ctx.post();
  assert.equal(response.status, 401);
  assert.equal(response.body.code, "AGENT_RETIRED");
  assert.equal(ctx.alerts.length, 0, "no Telegram every 4 hours for a retired machine");
  assert.equal(ctx.events[0].eventType, "agent_retired_report");

  ctx = reportRoute(null, { retired: false });
  response = await ctx.post();
  assert.equal(response.status, 401);
  assert.equal(response.body.code, undefined);
  assert.equal(ctx.alerts.length, 1);
});

test("manual uninstall one-liners: basePath-aware URLs, -UseBasicParsing, notify flag", () => {
  const install = loadTs("lib/agent-install.ts", {}, { process: { env: { NEXT_PUBLIC_APP_URL: "https://stn.moph.go.th/stns-atacs/" } } });
  const win = install.buildWindowsAgentUninstallCommand();
  assert.match(win, /\$base='https:\/\/stn\.moph\.go\.th\/stns-atacs'/);
  assert.match(win, /Invoke-WebRequest -UseBasicParsing "\$base\/agent\/windows\/uninstall-atacs-agent\.ps1"/);
  assert.match(win, /uninstall-atacs-agent\.ps1"\) -NotifyServer$/);
  const linux = install.buildLinuxAgentUninstallCommand();
  assert.match(linux, /base='https:\/\/stn\.moph\.go\.th\/stns-atacs'/);
  assert.match(linux, /download "\$base\/agent\/linux\/uninstall-atacs-agent\.sh"/);
  assert.match(linux, /sudo bash "\$dir\/uninstall-atacs-agent\.sh" --notify-server$/);
});

test("migration is idempotent and registered", () => {
  const sql = read("database/add_agent_uninstall.sql");
  for (const column of ["uninstall_requested_at", "uninstall_requested_by", "uninstalled_at"]) {
    assert.match(sql, new RegExp(`COLUMN_NAME = '${column}'`));
  }
  assert.match(sql, /information_schema\.STATISTICS/);
  assert.equal((sql.match(/^PREPARE /gm) ?? []).length, 4);
  const requirements = JSON.parse(read("database/schema-requirements.json"));
  const entry = requirements.find((item) => item.file.startsWith("add_agent_uninstall.sql"));
  assert.deepEqual(entry.columns.agent_devices, ["uninstall_requested_at", "uninstall_requested_by", "uninstalled_at"]);
});

// ---------------------------------------------------------------- agent scripts

const hasPython = spawnSync("python3", ["--version"]).status === 0;
const agentPy = new URL("../public/agent/linux/atacs-agent.py", import.meta.url).pathname;

function makeStubBin(dir) {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  const log = path.join(dir, "systemctl.log");
  fs.writeFileSync(path.join(bin, "systemctl"), `#!/bin/sh\necho "$@" >> "${log}"\nexit 0\n`, { mode: 0o755 });
  return { bin, log };
}

const PY_HARNESS = String.raw`
import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location("atacs_agent", sys.argv[1])
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
root = sys.argv[2]

def layout(name):
    base = os.path.join(root, name)
    install = os.path.join(base, "opt", "atacs-agent")
    state = os.path.join(base, "var", "lib", "atacs-agent")
    units = os.path.join(base, "etc", "systemd", "system")
    for d in (install, state, os.path.join(units, "timers.target.wants"), os.path.join(base, "etc", "cron.d")):
        os.makedirs(d)
    open(os.path.join(install, "atacs-agent.py"), "w").write("# agent")
    open(os.path.join(install, "atacs-agent.py.bak"), "w").write("# old")
    config = os.path.join(state, "agent-config.json")
    open(config, "w").write("{}")
    for unit in ("atacs-agent.service", "atacs-agent.timer"):
        open(os.path.join(units, unit), "w").write("[Unit]")
    os.symlink(os.path.join(units, "atacs-agent.timer"), os.path.join(units, "timers.target.wants", "atacs-agent.timer"))
    cron = os.path.join(base, "etc", "cron.d", "atacs-agent")
    open(cron, "w").write("0 */4 * * * root true")
    return {"base": base, "install": install, "state": state, "config": config, "units": units, "cron": cron}

def remover_for(paths):
    def remover(install_dir, config_path):
        return agent.remove_installation(install_dir, config_path, systemd_dir=paths["units"], cron_file=paths["cron"], cron_log_file=os.path.join(paths["base"], "atacs-agent.log"))
    return remover

def snapshot(paths):
    return {
        "install": os.path.exists(paths["install"]),
        "config": os.path.exists(paths["config"]),
        "state": os.path.exists(paths["state"]),
        "units": sorted(os.listdir(paths["units"])) if os.path.isdir(paths["units"]) else None,
        "wants": sorted(os.listdir(os.path.join(paths["units"], "timers.target.wants"))),
        "cron": os.path.exists(paths["cron"]),
    }

config = {"apiBaseUrl": "https://stn.moph.go.th/stns-atacs", "agentId": "agent-5", "agentKey": "secret-key"}
instruction = {"requestedAt": "2026-11-05T09:00:00+07:00"}
results = {}

def run(name, uninstall, cfg, poster, trigger="instruction"):
    paths = layout(name)
    calls = []
    def post(url, body, headers):
        calls.append({"url": url, "body": body, "headers": headers})
        return poster(url, body, headers)
    ok = agent.self_uninstall(uninstall, cfg, paths["config"], install_dir=paths["install"], poster=post, remover=remover_for(paths), trigger=trigger)
    results[name] = {"ok": ok, "calls": calls, "after": snapshot(paths)}

def confirmed(url, body, headers):
    return {"ok": True, "uninstalled": True}
def offline(url, body, headers):
    raise RuntimeError("Request failed: timed out")
def conflict(url, body, headers):
    raise agent.HttpError(409, "HTTP 409: UNINSTALL_NOT_REQUESTED")

run("good", instruction, config, confirmed)
run("confirmFails", instruction, config, offline)
run("cancelled", instruction, config, conflict)
run("notConfirmed", instruction, config, lambda u, b, h: {"ok": True})
run("http", instruction, dict(config, apiBaseUrl="http://stn.moph.go.th/stns-atacs"), confirmed)
run("garbage", "yes please", config, confirmed)
run("retry", None, config, confirmed, trigger="rejected")
run("localhost", instruction, dict(config, apiBaseUrl="http://localhost:3000"), confirmed)
results["capabilities"] = agent.AGENT_CAPABILITIES
print(json.dumps(results))
`;

test("Linux agent self_uninstall: confirms first, then removes units/cron/config/install dir", { skip: !hasPython }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atacs-uninstall-"));
  try {
    const { bin, log } = makeStubBin(dir);
    const result = spawnSync("python3", ["-B", "-c", PY_HARNESS, agentPy, dir], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    assert.equal(result.status, 0, result.stderr);
    const r = JSON.parse(result.stdout.trim().split("\n").filter((line) => line.startsWith("{")).at(-1));
    const untouched = { install: true, config: true, state: true, units: ["atacs-agent.service", "atacs-agent.timer", "timers.target.wants"], wants: ["atacs-agent.timer"], cron: true };
    const gone = { install: false, config: false, state: false, units: ["timers.target.wants"], wants: [], cron: false };

    assert.equal(r.good.ok, true);
    assert.deepEqual(r.good.after, gone);
    assert.equal(r.good.calls.length, 1);
    assert.equal(r.good.calls[0].url, "https://stn.moph.go.th/stns-atacs/api/agent/uninstalled/");
    assert.deepEqual(r.good.calls[0].headers, { "x-agent-id": "agent-5", "x-agent-key": "secret-key" });
    assert.equal(r.good.calls[0].body.reason, "remote");

    for (const name of ["confirmFails", "cancelled", "notConfirmed"]) {
      assert.equal(r[name].ok, false, name);
      assert.equal(r[name].calls.length, 1, name);
      assert.deepEqual(r[name].after, untouched, `${name}: nothing removed, retry next run`);
    }
    for (const name of ["http", "garbage"]) {
      assert.equal(r[name].ok, false, name);
      assert.equal(r[name].calls.length, 0, `${name}: refused before contacting the server`);
      assert.deepEqual(r[name].after, untouched, name);
    }
    assert.equal(r.retry.ok, true, "401 AGENT_RETIRED -> idempotent confirmation -> removal");
    assert.equal(r.localhost.ok, true, "http only for the localhost dev server");
    assert.deepEqual(r.capabilities, ["self-update", "self-uninstall"]);

    const systemctl = fs.readFileSync(log, "utf8");
    assert.match(systemctl, /^disable --now atacs-agent\.timer$/m);
    assert.match(systemctl, /^daemon-reload$/m);
    assert.doesNotMatch(systemctl, /^stop atacs-agent\.service$/m, "never stop the service the agent is running in");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Linux manual uninstall script removes the same things (stubbed systemctl, temp paths)", { skip: spawnSync("bash", ["--version"]).status !== 0 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atacs-uninstall-sh-"));
  try {
    const { bin, log } = makeStubBin(dir);
    const install = path.join(dir, "opt", "atacs-agent");
    const state = path.join(dir, "var", "lib", "atacs-agent");
    const units = path.join(dir, "systemd");
    for (const d of [install, state, path.join(units, "timers.target.wants"), path.join(dir, "cron.d")]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(install, "atacs-agent.py"), "#");
    fs.writeFileSync(path.join(state, "agent-config.json"), "{}");
    fs.writeFileSync(path.join(units, "atacs-agent.timer"), "");
    fs.writeFileSync(path.join(units, "atacs-agent.service"), "");
    fs.symlinkSync(path.join(units, "atacs-agent.timer"), path.join(units, "timers.target.wants", "atacs-agent.timer"));
    fs.writeFileSync(path.join(dir, "cron.d", "atacs-agent"), "");
    const script = new URL("../public/agent/linux/uninstall-atacs-agent.sh", import.meta.url).pathname;
    const result = spawnSync("bash", [script, "--install-root", install, "--config-path", path.join(state, "agent-config.json")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        ATACS_UNINSTALL_ALLOW_NON_ROOT: "1",
        ATACS_SYSTEMD_DIR: units,
        ATACS_CRON_FILE: path.join(dir, "cron.d", "atacs-agent"),
        ATACS_CRON_LOG_FILE: path.join(dir, "atacs-agent.log"),
      },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(fs.existsSync(install), false);
    assert.equal(fs.existsSync(state), false);
    assert.deepEqual(fs.readdirSync(units), ["timers.target.wants"]);
    assert.deepEqual(fs.readdirSync(path.join(units, "timers.target.wants")), []);
    assert.equal(fs.existsSync(path.join(dir, "cron.d", "atacs-agent")), false);
    assert.match(fs.readFileSync(log, "utf8"), /disable --now atacs-agent\.timer[\s\S]*daemon-reload/);
    assert.match(result.stdout, /uninstall completed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Windows agent remote uninstall: confirm before removal, task names match the installer, PS 5.1 safe", () => {
  const ps = read("public/agent/windows/atacs-agent.ps1");
  const installer = read("public/agent/windows/install-atacs-agent.ps1");
  const manual = read("public/agent/windows/uninstall-atacs-agent.ps1");
  const taskName = installer.match(/\$taskName = "([^"]+)"/)[1];
  assert.equal(taskName, "ATACS Agent Inventory");
  assert.ok(ps.includes(`$script:AgentTaskName = "${taskName}"`));
  assert.ok(manual.includes(`$taskName = "${taskName}"`));
  assert.match(ps, /\$script:AgentCapabilities = @\("self-update", "self-uninstall"\)/);
  for (const source of [ps, manual]) {
    assert.match(source, /Unregister-ScheduledTask -TaskName \$\w+ -Confirm:\$false/);
    assert.match(source, /schtasks\.exe \/Delete \/TN "\$\w+" \/F/);
  }
  // The confirmation comes before any removal and its failure returns without removing.
  const fn = ps.slice(ps.indexOf("function Invoke-AgentSelfUninstall"), ps.indexOf("function Ensure-Directory"));
  assert.ok(fn.indexOf("Send-UninstallConfirmation") < fn.indexOf("Remove-AgentInstallation"));
  assert.match(fn, /catch \{ Write-UninstallLog "confirmation failed[^\n]*return \$false \}/);
  assert.match(fn, /Test-ServerTrustedForUninstall -Base \$base/);
  // The running folder is removed by a detached process after this one exits; never Remove-Item on itself.
  assert.match(ps, /Win32_Process -MethodName Create/);
  assert.match(ps, /ping -n 6 127\.0\.0\.1 >nul/);
  assert.match(ps, /\$installRoot = Split-Path -Parent \$script:AgentScriptPath/);
  // Remote uninstall runs before the self-update, and an uninstalling machine never updates.
  const main = ps.slice(ps.lastIndexOf("$result = Send-Inventory"));
  assert.ok(main.indexOf("$result.uninstall") < main.indexOf("Invoke-AgentSelfUpdate -Update"));
  // New PowerShell code stays ASCII (PS 5.1 reads BOM-less files as ANSI).
  assert.doesNotMatch(manual, /[^\x00-\x7f]/);
  assert.doesNotMatch(main, /[^\x00-\x7f]/);
});

const pwsh = [process.env.PWSH, "pwsh", path.join(os.homedir(), ".hermes/cache/scratch/pwsh/pwsh")]
  .filter(Boolean)
  .find((candidate) => spawnSync(candidate, ["-v"]).status === 0);

test("PowerShell: every agent script parses, uninstall logic behaves with stubbed I/O", { skip: !pwsh }, () => {
  for (const file of ["atacs-agent.ps1", "install-atacs-agent.ps1", "repoint-atacs-agent.ps1", "uninstall-atacs-agent.ps1"]) {
    const file_ = new URL(`../public/agent/windows/${file}`, import.meta.url).pathname;
    const result = spawnSync(pwsh, ["-NoProfile", "-Command", `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${file_}',[ref]$t,[ref]$e);if($e.Count){$e|%{$_.ToString()};exit 1}`], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stdout}${result.stderr}`);
  }
  // Load only the functions from the real agent (the script body would run the agent), then stub I/O.
  const agentPs = new URL("../public/agent/windows/atacs-agent.ps1", import.meta.url).pathname;
  const script = String.raw`
$ErrorActionPreference = "Stop"
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${agentPs}', [ref]$null, [ref]$null)
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false)) { . ([scriptblock]::Create($f.Extent.Text)) }
$script:AgentVersion = "2.2.0"
$script:AgentScriptPath = "/opt/fake/ATACSAgent/atacs-agent.ps1"
$global:removed = 0; $global:posted = @()
function Test-SafeInstallRoot { param([string]$Path) return $true }
function Remove-AgentInstallation { param([string]$ConfigPath, [string]$InstallRoot) $global:removed++ }
function Write-UninstallLog { param([string]$Message) }
$config = [pscustomobject]@{ apiBaseUrl = "https://stn.moph.go.th/stns-atacs"; agentId = "a"; agentKey = "k" }
$instruction = [pscustomobject]@{ requestedAt = "2026-11-05T09:00:00+07:00" }
$out = [ordered]@{}
function Invoke-JsonPost { param($Url, $Body, $Headers) $global:posted += $Url; return [pscustomobject]@{ ok = $true; uninstalled = $true } }
$out.good = Invoke-AgentSelfUninstall -Uninstall $instruction -Config $config -ConfigPath "c"
$out.goodRemoved = $global:removed
function Invoke-JsonPost { param($Url, $Body, $Headers) throw "HTTP 500" }
$out.fails = Invoke-AgentSelfUninstall -Uninstall $instruction -Config $config -ConfigPath "c"
function Invoke-JsonPost { param($Url, $Body, $Headers) return [pscustomobject]@{ ok = $true } }
$out.notConfirmed = Invoke-AgentSelfUninstall -Uninstall $instruction -Config $config -ConfigPath "c"
$out.http = Invoke-AgentSelfUninstall -Uninstall $instruction -Config ([pscustomobject]@{ apiBaseUrl = "http://stn.moph.go.th"; agentId = "a"; agentKey = "k" }) -ConfigPath "c"
$out.noRequestedAt = Invoke-AgentSelfUninstall -Uninstall ([pscustomobject]@{ requestedAt = "" }) -Config $config -ConfigPath "c"
$out.removedTotal = $global:removed
$out.posted = $global:posted
$out | ConvertTo-Json -Compress
`;
  const result = spawnSync(pwsh, ["-NoProfile", "-Command", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const r = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(r.good, true);
  assert.equal(r.goodRemoved, 1);
  assert.equal(r.fails, false);
  assert.equal(r.notConfirmed, false);
  assert.equal(r.http, false);
  assert.equal(r.noRequestedAt, false);
  assert.equal(r.removedTotal, 1, "only the confirmed run removed anything");
  assert.deepEqual([r.posted].flat(), ["https://stn.moph.go.th/stns-atacs/api/agent/uninstalled/"]);
});
