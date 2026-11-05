import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup({ auditFails = false } = {}) {
  const calls = { updates: [], separateHistory: 0, audits: 0 };
  const actions = loadTs("app/(main)/disposal/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(to) { throw Object.assign(new Error("redirect"), { to }); } },
    "@/lib/auth": { getCurrentUser: async () => ({ id: 1, role: "officer", fullName: "Officer", facilityId: 10, managedAssetFacilityIds: [] }) },
    "@/lib/role-permissions": { hasPermission: async () => true },
    "@/lib/permissions": { canManageAsset: () => true, canMutateAssets: () => true, canManageFacility: () => true },
    "@/lib/assets": {
      getAssetById: async () => ({ id: 5, facilityId: 10, currentStatus: "Active", assetClass: "IT", extensions: {} }),
      updateAsset: async (id, fields, options) => { calls.updates.push({ id, fields, options }); },
    },
    "@/lib/asset-status-history": { recordAssetStatusHistory: async () => { calls.separateHistory += 1; } },
    "@/lib/asset-disposals": {},
    "@/lib/asset-valuation": { valueAsset: () => ({ status: "ok", bookValue: 0 }) },
    "@/lib/audit": {
      writeAuditLog: async () => { if (auditFails) throw new Error("audit down"); calls.audits += 1; },
      writeAuditLogSafe: async () => { if (!auditFails) calls.audits += 1; },
    },
    "@/lib/inspection": {},
    "@/lib/inspection-report": {},
    "@/lib/telegram": { notifyTelegramSafe: async () => {} },
  });
  return { actions, calls };
}

function form(extra = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ assetId: "5", disposalType: "Broken", reason: "จอแตก", noteDate: "2026-01-05", ...extra })) fd.set(key, value);
  return fd;
}

test("Broken/Inactive: status change and its history are one atomic repository call", async () => {
  const { actions, calls } = setup();
  await assert.rejects(actions.disposalAssetAction(null, form()), (error) => error.to === "/assets/5");
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].fields.currentStatus, "Broken");
  assert.equal(calls.updates[0].options.history.toStatus, "Broken");
  assert.equal(calls.updates[0].options.history.fromStatus, "Active");
  assert.match(calls.updates[0].options.history.note, /บันทึกชำรุด/);
  assert.equal(calls.separateHistory, 0);
});

test("Broken/Inactive: an audit failure after commit does not report the save as failed", async () => {
  const { actions, calls } = setup({ auditFails: true });
  await assert.rejects(actions.disposalAssetAction(null, form({ disposalType: "Inactive" })), (error) => error.to === "/assets/5");
  assert.equal(calls.updates.length, 1);
});
