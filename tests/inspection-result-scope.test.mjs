import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup(context) {
  const calls = { tx: 0, assetWrites: [], itemWrites: [], contextLocks: [] };
  const lib = loadTs("lib/inspection-results.ts", {
    "@/lib/mysql": { withTransaction: async (work) => { calls.tx += 1; return work(); } },
    "@/lib/asset-status-history": { ensureAssetStatusHistoryTable: async () => {}, recordAssetStatusHistory: async () => {} },
    "@/lib/assets": { updateAsset: async (id, fields) => { calls.assetWrites.push({ id, fields }); } },
    "@/lib/audit": { writeAuditLog: async () => {} },
    "@/lib/facility-work-groups": { listFacilityWorkGroups: async () => [] },
    "@/lib/inspection": {
      getInspectionItemContext: async (id, options) => { calls.contextLocks.push(Boolean(options?.forUpdate)); return context; },
      getInspectionById: async () => ({ roundStatus: "Open" }),
      updateInspectionItem: async (input) => { calls.itemWrites.push(input); },
    },
  });
  return { lib, calls };
}

const admin = { id: 1, fullName: "Admin", role: "admin" };
const base = { id: 3, inspectionId: 2, facilityId: 10, assetFacilityId: 10, assetId: 7, currentStatus: "Active", workGroupId: null, locationDetail: "" };

test("a result cannot change an asset that has since moved to another facility", async () => {
  const { lib, calls } = setup({ ...base, assetFacilityId: 20 });
  await assert.rejects(lib.recordInspectionResult(admin, { itemId: 3, inspectionStatus: "Found", assetStatus: "Broken" }), /โอนย้ายไปหน่วยงานอื่นแล้ว/);
  assert.equal(calls.itemWrites.length, 0);
  assert.equal(calls.assetWrites.length, 0);
});

test("item, status and history are written in one transaction on a locked row", async () => {
  const { lib, calls } = setup(base);
  await lib.recordInspectionResult(admin, { itemId: 3, inspectionStatus: "Found", assetStatus: "Broken" });
  assert.equal(calls.tx, 1);
  assert.deepEqual(calls.contextLocks, [true]);
  assert.equal(calls.itemWrites.length, 1);
  assert.equal(calls.assetWrites[0].fields.currentStatus, "Broken");
});
