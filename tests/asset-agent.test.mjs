import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup({ linkedAssetId = null, candidateClass = "IT", candidateType = "Desktop", candidateCategory = "Hardware", candidateFacility = 10, candidates = true } = {}) {
  const writes = [], assetWrites = [], reads = [];
  const agent = loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": {
      findOrCreateSurvey: async () => 1,
      createAsset: async input => { assetWrites.push(["create", input]); return { insertId: 8 }; },
      updateAsset: async (id, input) => { assetWrites.push(["update", id, input]); },
    },
    "@/lib/mysql": {
      executeStatement: async (sql, values) => { writes.push({ sql, values }); return { insertId: 1 }; },
      selectRows: async (sql, values) => {
        reads.push({ sql, values });
        if (sql.includes("WHERE ad.agent_uuid")) return [{ id: 1, facility_id: 10, agent_uuid: "agent-1", linked_asset_id: linkedAssetId, status: "online" }];
        if (sql.includes("SELECT facility_id FROM agent_devices")) return [{ facility_id: 10 }];
        if (sql.includes("FROM information_assets")) return candidates ? [{ id: 7, survey_id: 99, asset_class: candidateClass, asset_category: candidateCategory, device_type: candidateType, facility_id: candidateFacility }] : [];
        return [];
      },
    },
  });
  const report = () => agent.reportAgentInventory({ agentId: "agent-1", agentKey: "secret", payload: { fingerprint: "fingerprint-1", hostname: "PC-1", serialNumber: "SERIAL-1", deviceType: "Desktop", operatingSystem: "Windows" } });
  return { agent, report, writes, assetWrites, reads };
}

test("Agent creates explicit IT and never matches non-IT using shared names/serials", async () => {
  const ctx = setup({ candidateClass: "Medical" });
  const result = await ctx.report();
  assert.equal(result.linkedAssetId, 8);
  assert.equal(ctx.assetWrites.length, 1);
  assert.equal(ctx.assetWrites[0][0], "create");
  assert.equal(ctx.assetWrites[0][1].assetClass, "IT");
});

test("Agent updates eligible existing computers without purchasing, license or classification fields", async () => {
  for (const linkedAssetId of [null, 7]) {
    const ctx = setup({ linkedAssetId });
    assert.equal((await ctx.report()).linkedAssetId, 7);
    const patch = ctx.assetWrites[0][2];
    assert.equal(ctx.assetWrites[0][0], "update");
    assert.equal(patch.surveyId, 99);
    for (const field of ["assetClass", "purchaseDate", "purchasePrice", "maintenanceStartDate", "maintenanceEndDate", "windowsLicenseStatus"]) assert.equal(Object.hasOwn(patch, field), false);
  }
});

test("invalid existing Agent links are rejected before any writes", async () => {
  for (const options of [{ candidateClass: "Vehicle" }, { candidateCategory: "Software" }, { candidateType: "Printer" }, { candidateFacility: 20 }]) {
    const ctx = setup({ linkedAssetId: 7, ...options });
    await assert.rejects(ctx.report(), /Agent/);
    assert.equal(ctx.writes.length, 0);
    assert.equal(ctx.assetWrites.length, 0);
  }
});

test("manual linking checks both class/type and facility on the server", async () => {
  for (const options of [{ candidateClass: "Office" }, { candidateCategory: "Software" }, { candidateType: "Firewall" }, { candidateFacility: 20 }]) {
    const ctx = setup(options);
    await assert.rejects(ctx.agent.linkAgentDeviceToAsset(1, 7));
    assert.equal(ctx.writes.length, 0);
  }
  const ctx = setup();
  await ctx.agent.linkAgentDeviceToAsset(1, 7);
  await ctx.agent.linkAgentDeviceToAsset(1, null);
  assert.equal(ctx.writes.length, 2);
});

test("heartbeat response remains compatible and never changes asset records", async () => {
  const ctx = setup();
  const result = await ctx.agent.heartbeatAgent({ agentId: "agent-1", agentKey: "secret" });
  assert.equal(result.deviceId, 1);
  assert.equal(ctx.assetWrites.length, 0);
  assert.match(ctx.writes[0].sql, /UPDATE agent_devices SET status/);
});
