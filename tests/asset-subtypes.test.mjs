import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
function setup(user, allowed = false) {
  const writes = [];
  const actions = loadTs("app/(main)/assets/subtype-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/role-permissions": { hasPermission: async () => allowed },
    "@/lib/asset-extensions": { listAssetSubtypes: async () => [] },
    "@/lib/audit": { writeAuditLog: async () => {} },
    "@/lib/mysql": { executeStatement: async (...args) => { writes.push(args); return { insertId: 1, affectedRows: 1 }; } },
  });
  return { actions, writes };
}
const form = values => { const fd = new FormData(); for (const [k,v] of Object.entries(values)) fd.set(k,v); return fd; };
test("subtype management requires authentication and management permission", async () => {
  for (const user of [null, { role: "viewer" }, { role: "officer" }]) {
    const ctx = setup(user);
    assert.match(await ctx.actions.saveAssetSubtype(null, form({ assetClass: "Office", name: "Desk" })), /สิทธิ์/);
    assert.equal(ctx.writes.length, 0);
    await assert.rejects(ctx.actions.getAssetSubtypeOptions());
  }
});
test("subtype management validates classes and disables without deleting", async () => {
  const ctx = setup({ id: 1, role: "admin", fullName: "Admin" }, true);
  assert.ok(await ctx.actions.saveAssetSubtype(null, form({ assetClass: "IT", name: "Invalid" })));
  assert.equal(ctx.writes.length, 0);
  assert.equal(await ctx.actions.saveAssetSubtype(null, form({ id: "7", assetClass: "Office", name: "Desk" })), null);
  assert.match(ctx.writes[0][0], /UPDATE.*is_active.*asset_class/);
  assert.deepEqual(Array.from(ctx.writes[0][1]), ["Desk", 0, 7, "Office"]);
});
