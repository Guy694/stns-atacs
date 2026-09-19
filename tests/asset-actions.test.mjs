import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup({ current = {}, role = "officer", permitted = true } = {}) {
  const writes = [], surveys = [], audits = [];
  const currentAsset = { id: 1, facilityId: 10, surveyId: 99, assetName: "Existing", assetClass: "Vehicle", assetCategory: "Hardware", currentStatus: "Broken", assetRegistrationNo: "CAR-1", purchaseDate: "2025-01-01", assetImage1Url: "/existing.webp", ...current };
  const actions = loadTs("app/(main)/assets/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect() { throw new Error("redirect"); } },
    "@/lib/auth": { getCurrentUser: async () => ({ id: 1, role, fullName: "Officer", facilityId: 10, managedAssetFacilityIds: [] }) },
    "@/lib/role-permissions": { hasPermission: async () => permitted },
    "@/lib/assets": {
      getAssetById: async () => currentAsset,
      findOrCreateSurvey: async id => { surveys.push(id); return 1; },
      createAsset: async input => { writes.push(input); return { insertId: 1 }; },
      updateAsset: async (_id, input) => writes.push(input),
    },
    "@/lib/asset-status-history": { recordAssetStatusHistory: async () => {} },
    "@/lib/audit": { writeAuditLog: async input => audits.push(input) },
    "@/lib/mysql": { selectRows: async () => [] },
  });
  const form = extra => {
    const fd = new FormData();
    for (const [key, value] of Object.entries({ assetId: "1", facilityId: "10", assetName: "Renamed", ...extra })) fd.set(key, value);
    return fd;
  };
  return { actions, writes, surveys, audits, form };
}

test("form edits preserve non-IT class, registration, images, dates, status and original survey", async () => {
  const ctx = setup();
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form()), null);
  const patch = ctx.writes[0];
  assert.equal(patch.assetClass, "Vehicle");
  assert.equal(patch.assetRegistrationNo, "CAR-1");
  assert.equal(patch.assetImage1Url, "/existing.webp");
  assert.equal(patch.purchaseDate, undefined);
  assert.equal(patch.currentStatus, undefined);
  assert.equal(patch.surveyId, 99);
  assert.equal(ctx.surveys.length, 0);
});

test("class changes require explicit confirmation and are audited", async () => {
  const ctx = setup();
  assert.match(await ctx.actions.updateAssetAction(null, ctx.form({ assetClass: "Office" })), /ยืนยัน/);
  assert.equal(ctx.writes.length, 0);
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form({ assetClass: "Office", confirmClassChange: "1" })), null);
  assert.match(ctx.audits[0].summary, /Vehicle → Office/);
});

test("form validation rejects invalid dates before survey or asset mutations", async () => {
  const ctx = setup();
  assert.match(await ctx.actions.createAssetAction(null, ctx.form({ assetClass: "Office", purchaseDate: "2025-02-30" })), /YYYY-MM-DD/);
  assert.equal(ctx.writes.length, 0);
  assert.equal(ctx.surveys.length, 0);
});

test("write permissions and facility boundaries remain enforced for non-IT", async () => {
  for (const options of [{ role: "viewer" }, { permitted: false }, { current: { facilityId: 20 } }]) {
    const ctx = setup(options);
    assert.ok(await ctx.actions.updateAssetAction(null, ctx.form()));
    assert.equal(ctx.writes.length, 0);
    assert.equal(ctx.surveys.length, 0);
  }
});
