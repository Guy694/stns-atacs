import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

/**
 * Flexible lib/agent.ts harness: `device` is the agent_devices row returned for credentials,
 * `asset` the information_assets row, `hasDeletedAt` toggles the information_schema probe.
 */
function harness({ device = {}, asset = {}, hasDeletedAt = false, execute, createAsset } = {}) {
  const writes = [], assetWrites = [], reads = [];
  const deviceRow = { id: 1, facility_id: 10, agent_uuid: "agent-1", device_fingerprint: "oldfingerprint", linked_asset_id: null, status: "online", ...device };
  const assetRow = { id: 7, survey_id: 99, asset_class: "IT", asset_category: "Hardware", device_type: "Desktop", facility_id: 10, current_status: "Active", deleted_at: null, ...asset };
  const agent = loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": {
      findOrCreateSurvey: async () => 99,
      createAsset: createAsset ?? (async (input) => { assetWrites.push(["create", input]); return { insertId: 8 }; }),
      updateAsset: async (id, input) => { assetWrites.push(["update", id, input]); },
    },
    "@/lib/mysql": {
      executeStatement: async (sql, values) => {
        if (execute) {
          const result = await execute(sql, values);
          if (result !== undefined) { writes.push({ sql, values }); return result; }
        }
        writes.push({ sql, values });
        return { insertId: 1, affectedRows: 1 };
      },
      selectRows: async (sql, values) => {
        reads.push({ sql, values });
        if (sql.includes("information_schema.COLUMNS")) return [{ total: hasDeletedAt ? 1 : 0 }];
        if (sql.includes("WHERE ad.agent_uuid")) return [deviceRow];
        if (sql.includes("FROM agent_devices ad") && sql.includes("ad.linked_asset_id = ?")) return [{ ...deviceRow, facility_name: "รพ.สต.A" }];
        if (sql.includes("SELECT facility_id FROM agent_devices")) return [{ facility_id: 10 }];
        if (sql.includes("FROM information_assets")) return [assetRow];
        return [];
      },
    },
  });
  const report = (payload = {}) => agent.reportAgentInventory({
    agentId: "agent-1", agentKey: "secret",
    payload: { fingerprint: "fingerprint-1", hostname: "PC-1", serialNumber: "SERIAL-1", deviceType: "Desktop", operatingSystem: "Windows", ...payload },
  });
  return { agent, report, writes, assetWrites, reads };
}

test("G5/G6: DB DATETIME values reach the UI as unambiguous Bangkok ISO timestamps", async () => {
  const ctx = harness({ device: { last_seen_at: new Date(2026, 10, 2, 9, 30, 0), last_reported_at: new Date(2026, 10, 2, 9, 31, 5), first_seen_at: "2026-11-01 08:00:00" } });
  assert.equal(ctx.agent.agentTimestamp(new Date(2026, 10, 2, 9, 30, 0)), "2026-11-02T09:30:00+07:00");
  assert.equal(ctx.agent.agentTimestamp("2026-11-02 09:30:00"), "2026-11-02T09:30:00+07:00");
  assert.equal(ctx.agent.agentTimestamp(null), null);

  const device = await ctx.agent.getAgentDeviceByLinkedAssetId(7);
  assert.equal(device.lastSeenAt, "2026-11-02T09:30:00+07:00");
  assert.equal(device.lastReportedAt, "2026-11-02T09:31:05+07:00");
  assert.equal(device.firstSeenAt, "2026-11-01T08:00:00+07:00");
  // the absolute instant is right wherever the code runs (UTC on Vercel, Bangkok in Docker)
  assert.equal(new Date(device.lastSeenAt).toISOString(), "2026-11-02T02:30:00.000Z");
  assert.match(device.lastReportedLabel, /09:31/);

  const { formatThaiDateTime } = loadTs("lib/date-format.ts");
  assert.match(formatThaiDateTime(device.lastSeenAt), /09:30/);
});

test("G5: agent-health parses Bangkok ISO strings and naive DB strings as Bangkok time", () => {
  const health = loadTs("lib/agent-health.ts");
  assert.equal(health.parseDbDateTime("2026-11-02T09:30:00+07:00"), Date.parse("2026-11-02T02:30:00Z"));
  assert.equal(health.parseDbDateTime("2026-11-02 09:30:00"), Date.parse("2026-11-02T02:30:00Z"));
  assert.equal(health.parseDbDateTime("2026-11-02T02:30:00Z"), Date.parse("2026-11-02T02:30:00Z"));
  assert.equal(health.parseDbDateTime(null), null);
});

test("G5: report timestamps come from the DB clock (NOW()), not a UTC string built in JS", async () => {
  const ctx = harness();
  await ctx.report();
  const deviceUpdates = ctx.writes.filter((write) => /UPDATE agent_devices/.test(write.sql) && /last_reported_at/.test(write.sql));
  assert.ok(deviceUpdates.length >= 1);
  for (const write of deviceUpdates) {
    assert.match(write.sql, /last_reported_at = NOW\(\)/);
    assert.ok(!write.values.some((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)));
  }
});

test("G13: health_json is cleared when a report has no health section", async () => {
  const ctx = harness();
  await ctx.report();
  const healthWrite = ctx.writes.find((write) => write.sql.includes("health_json"));
  assert.ok(healthWrite, "health_json must be written even without health");
  assert.equal(healthWrite.values[0], null);
});

test("G7: an admin unlink is sticky — later reports do not auto-link or create an asset", async () => {
  const ctx = harness();
  await ctx.agent.linkAgentDeviceToAsset(1, null);
  const unlink = ctx.writes.at(-1);
  assert.match(unlink.sql, /auto_link_disabled = 1/);

  const reporting = harness({ device: { linked_asset_id: null, auto_link_disabled: 1 } });
  const result = await reporting.report();
  assert.equal(result.linkedAssetId, null);
  assert.equal(reporting.assetWrites.length, 0);
  assert.ok(!reporting.reads.some((read) => read.sql.includes("a.serial_number = ?") || read.sql.includes("a.asset_name = ?")));
  assert.ok(reporting.writes.some((write) => write.sql.includes("raw_payload_json")), "device data is still saved");
});

test("G7: linking to an asset re-enables auto-link; unlink still works before the migration", async () => {
  const ctx = harness();
  await ctx.agent.linkAgentDeviceToAsset(1, 7);
  assert.match(ctx.writes.at(-1).sql, /auto_link_disabled = 0/);

  const legacy = harness({
    execute: async (sql) => {
      if (sql.includes("auto_link_disabled")) {
        const error = new Error("Unknown column 'auto_link_disabled'");
        error.code = "ER_BAD_FIELD_ERROR";
        throw error;
      }
      return undefined;
    },
  });
  await legacy.agent.linkAgentDeviceToAsset(1, null);
  const fallback = legacy.writes.at(-1);
  assert.match(fallback.sql, /SET linked_asset_id = \?/);
  assert.ok(!fallback.sql.includes("auto_link_disabled"));
});

test("G7: a duplicate AGT registration number reuses the existing asset instead of failing", async () => {
  const ctx = harness({
    asset: { id: 55, current_status: "Active" },
    createAsset: async () => {
      const error = new Error("Duplicate entry 'AGT-010-000001'");
      error.code = "ER_DUP_ENTRY";
      throw error;
    },
  });
  // nothing matches by serial/hostname, so the auto-create path runs
  const originalReads = ctx.reads;
  const result = await ctx.agent.reportAgentInventory({ agentId: "agent-1", agentKey: "secret", payload: { fingerprint: "fingerprint-1", deviceType: "Desktop" } });
  assert.equal(result.linkedAssetId, 55);
  assert.ok(originalReads.some((read) => read.sql.includes("a.asset_registration_no = ?") && read.values.includes("AGT-010-000001")));
  assert.equal(ctx.assetWrites[0][0], "update");
  assert.equal(ctx.assetWrites[0][1], 55);
  const finalLink = ctx.writes.find((write) => write.sql.includes("SET linked_asset_id = ?"));
  assert.equal(finalLink.values[0], 55);
});

test("G7: asset matching skips soft-deleted assets only when assets.deleted_at exists", async () => {
  const withColumn = harness({ hasDeletedAt: true });
  await withColumn.report();
  const candidateRead = withColumn.reads.find((read) => read.sql.includes("a.serial_number = ?"));
  assert.match(candidateRead.sql, /a\.deleted_at IS NULL/);

  const withoutColumn = harness({ hasDeletedAt: false });
  await withoutColumn.report();
  const legacyRead = withoutColumn.reads.find((read) => read.sql.includes("a.serial_number = ?"));
  assert.ok(!legacyRead.sql.includes("deleted_at"));
});

test("G10: an invalid linked asset still records the heartbeat, then fails with a clear conflict", async () => {
  // moved to another facility, reclassified, wrong type, soft-deleted
  for (const [asset, hasDeletedAt] of [[{ facility_id: 20 }, false], [{ asset_class: "Vehicle" }, false], [{ device_type: "Printer" }, false], [{ deleted_at: new Date() }, true]]) {
    const ctx = harness({ device: { linked_asset_id: 7 }, asset, hasDeletedAt });
    await assert.rejects(ctx.report(), (error) => error.message === "LINKED_ASSET_INVALID" && error.linkedAssetId === 7);
    const deviceUpdate = ctx.writes.find((write) => write.sql.includes("raw_payload_json"));
    assert.ok(deviceUpdate, "device row is updated first");
    assert.match(deviceUpdate.sql, /last_seen_at = NOW\(\)/);
    assert.equal(ctx.assetWrites.length, 0);
    assert.ok(!ctx.writes.some((write) => write.sql.includes("SET linked_asset_id")));
  }
});

test("S3: Windows one-liners use -UseBasicParsing (works without the IE engine)", () => {
  const install = loadTs("lib/agent-install.ts", {}, { process: { env: {} } });
  for (const command of [install.buildWindowsAgentInstallCommand("tok"), install.buildWindowsStaticAgentInstallCommand({ facilityId: 3 })]) {
    const downloads = command.split("; ").filter((part) => part.startsWith("Invoke-WebRequest"));
    assert.equal(downloads.length, 2);
    for (const part of downloads) assert.match(part, /-UseBasicParsing/);
  }
});

test("G9/G11/G12: request body reader enforces a byte cap while streaming", async () => {
  const body = loadTs("app/api/agent/_lib/request-body.ts");
  const small = new Request("http://x/", { method: "POST", body: JSON.stringify({ a: "ไทย" }) });
  assert.equal(JSON.stringify(await body.readJsonBody(small, 1024)), JSON.stringify({ ok: true, value: { a: "ไทย" } }));

  const big = new Request("http://x/", { method: "POST", body: "x".repeat(5000) });
  const tooLarge = await body.readJsonBody(big, 1024);
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.status, 413);

  const declared = new Request("http://x/", { method: "POST", body: "{}", headers: { "content-length": "999999" } });
  assert.equal((await body.readJsonBody(declared, 1024)).status, 413);

  const invalid = await body.readJsonBody(new Request("http://x/", { method: "POST", body: "{nope" }), 1024);
  assert.equal(invalid.status, 400);

  assert.equal(body.optionalString("x"), "x");
  assert.equal(body.optionalString(undefined), undefined);
  assert.equal(body.optionalString(null), undefined);
  assert.equal(body.optionalString(42), body.INVALID);
  assert.equal(body.optionalString({}), body.INVALID);
});

test("G9: enrollment limiter counts only failures per IP and caps successes per facility", () => {
  const limits = loadTs("app/api/agent/_lib/enroll-limits.ts");
  const now = 1_000_000;
  for (let i = 0; i < 400; i += 1) limits.recordEnrollSuccess("facility:1", now);
  assert.equal(limits.enrollSuccessAllowed("facility:1", now).allowed, false);
  assert.equal(limits.enrollSuccessAllowed("facility:2", now).allowed, true);
  // a NAT with many good installs is never blocked by the failure limiter
  assert.equal(limits.enrollFailureAllowed("10.0.0.1", now).allowed, true);
  for (let i = 0; i < limits.ENROLL_FAILURE_LIMIT; i += 1) limits.recordEnrollFailure("10.0.0.1", now);
  const blocked = limits.enrollFailureAllowed("10.0.0.1", now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(limits.enrollFailureAllowed("10.0.0.1", now + limits.ENROLL_WINDOW_MS + 1).allowed, true);
});

test("G1/S6/G8: Linux agent stays Python 3.6 compatible and re-enrolls on reinstall", () => {
  const source = read("public/agent/linux/atacs-agent.py");
  assert.ok(!source.includes("from __future__ import annotations"));
  assert.ok(!/text=True/.test(source));
  assert.ok(!/:=/.test(source), "no walrus operator");
  assert.ok(!/import dataclasses|from dataclasses/.test(source));
  assert.ok(!/\b(str|int|dict|list|set) \| None/.test(source), "no PEP 604 unions");
  assert.ok(!/(?<![A-Za-z_.])(dict|list|set|tuple)\[/.test(source), "no PEP 585 generics");
  assert.match(source, /universal_newlines=True/);
  assert.ok(!/return run_command\("lscpu"\)\s*$/m.test(source), "CPU fallback must not return the whole lscpu output");
  assert.match(source, /force_enroll/);
});

test("G2/G3/G4/S1/S2/S4: Windows scripts use real cmdlets, fail loudly and send UTF-8", () => {
  const installer = read("public/agent/windows/install-atacs-agent.ps1");
  const agent = read("public/agent/windows/atacs-agent.ps1");
  assert.ok(!installer.includes("New-ScheduledTaskRepetitionSettingsSet"));
  assert.match(installer, /-RepetitionInterval \(New-TimeSpan -Hours 4\)/);
  assert.match(installer, /\$LASTEXITCODE/);
  assert.match(installer, /-EnrollOnly/);
  assert.match(agent, /charset=utf-8/);
  assert.match(agent, /UTF8\.GetBytes\(\$json\)/);
  assert.match(agent, /LicenseStatus -eq 1/);
  assert.match(agent, /03000200-0400-0500-0006-000700080009/);
  assert.match(agent, /ErrorDetails/);
});

test("S5: systemd unit passes through proxy settings from the install environment", () => {
  const installer = read("public/agent/linux/install-atacs-agent.sh");
  assert.match(installer, /https_proxy/);
  assert.match(installer, /Environment=/);
  assert.match(installer, /--enroll-only/);
});

test("agent version strings are consistent across scripts", () => {
  const py = read("public/agent/linux/atacs-agent.py").match(/AGENT_VERSION = "([\d.]+)"/)[1];
  const ps = read("public/agent/windows/atacs-agent.ps1").match(/\$script:AgentVersion = "([\d.]+)"/)[1];
  assert.equal(py, ps);
  assert.equal(py, "2.1.0");
  assert.equal(fs.existsSync(new URL("../scripts/agent", import.meta.url)), false, "stale scripts/agent copy removed");
  assert.equal(fs.existsSync(new URL("../public/agent/linux/__pycache__", import.meta.url)), false);
});
