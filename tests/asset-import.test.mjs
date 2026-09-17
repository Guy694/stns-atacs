import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as XLSX from "xlsx";

function load(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, Buffer, File, require(id) {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  } });
  return exports;
}
const permissions = load("../lib/permissions.ts", { "server-only": {} });
const officer = { id: 1, fullName: "Officer", role: "officer", facilityId: 10, managedAssetFacilityIds: [20] };

function setup({ user = officer, create = true, update = true, existingFacility = 10 } = {}) {
  const writes = [];
  const alerts = [];
  const audits = [];
  const noop = async () => {};
  const route = load("../app/api/import/assets/route.ts", {
    xlsx: XLSX,
    "next/server": { NextResponse: Response },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/asset-classes": { ASSET_CLASS_VALUE_SET: new Set(["IT"]), normalizeAssetClass: (v) => v },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/permissions": permissions,
    "@/lib/role-permissions": { hasPermission: async (_, key) => key === "assets.create" ? create : update },
    "@/lib/security": { readRequestIp: () => "test", recordSecurityEvent: noop },
    "@/lib/audit": { writeAuditLog: async (input) => audits.push(input) },
    "@/lib/telegram": { notifyTelegramSafe: async (input) => alerts.push(input) },
    "@/lib/asset-status-history": { recordAssetStatusHistory: noop },
    "@/lib/windows-license": { isComputerDeviceType: () => false, WINDOWS_LICENSE_STATUS_VALUES: ["Genuine", "Pirated"] },
    "@/lib/mysql": { selectRows: async (sql) => sql.includes("WHERE a.id = ?")
      ? [{ id: 7, facility_id: existingFacility, current_status: "Active" }] : [] },
    "@/lib/assets": {
      findOrCreateSurvey: async (id) => { writes.push(["survey", id]); return 1; },
      createAsset: async (input) => { writes.push(["create", input]); return { insertId: 8 }; },
      updateAsset: async (id, input) => { writes.push(["update", id, input]); },
    },
  });
  async function request({ facility = 10, csv = "asset_name\nPrinter", invalidFile = false, malformed = false } = {}) {
    const form = new FormData();
    form.set("facilityId", String(facility));
    form.set("file", invalidFile ? "not a file" : new File([csv], "assets.csv"));
    const response = await route.POST({ headers: new Headers(), nextUrl: new URL("http://localhost/api/import/assets"),
      formData: async () => { if (malformed) throw new Error("bad form"); return form; } });
    return { status: response.status, body: await response.json() };
  }
  return { request, writes, alerts, audits };
}

test("officer imports into own and additionally managed facilities", async () => {
  for (const facility of [10, 20]) {
    const ctx = setup();
    const result = await ctx.request({ facility });
    assert.equal(result.status, 200);
    assert.equal(result.body.created, 1);
    assert.equal(ctx.writes.find(([action]) => action === "create")[1].updatedBy, "Officer");
  }
});

test("anonymous, viewer, unassigned and out-of-scope users cannot import", async () => {
  for (const [user, facility, status] of [[null, 10, 401], [{ ...officer, role: "viewer" }, 10, 403],
    [{ ...officer, facilityId: null, managedAssetFacilityIds: [] }, 10, 403], [officer, 30, 403]]) {
    const ctx = setup({ user });
    assert.equal((await ctx.request({ facility })).status, status);
    assert.equal(ctx.writes.length, 0);
  }
});

test("revoked create and update permissions reject before any database mutation", async () => {
  const ctx = setup({ create: false, update: false });
  assert.equal((await ctx.request()).status, 403);
  assert.equal(ctx.writes.length, 0);
});

test("per-row create/update permissions and facility boundaries are enforced", async () => {
  const csv = "id,asset_name\n,New printer\n7,Existing printer";
  for (const [options, created, updated] of [
    [{ create: true, update: false }, 1, 0],
    [{ create: false, update: true }, 0, 1],
    [{ existingFacility: 20 }, 1, 0],
  ]) {
    const ctx = setup(options);
    const { body } = await ctx.request({ csv });
    assert.equal(body.created, created);
    assert.equal(body.updated, updated);
    assert.equal(body.skipped, 1);
  }
});

test("malformed form bodies and non-file uploads return 400", async () => {
  for (const options of [{ invalidFile: true }, { malformed: true }]) {
    const ctx = setup();
    assert.equal((await ctx.request(options)).status, 400);
    assert.equal(ctx.writes.length, 0);
    assert.equal(ctx.alerts.length, 0);
  }
});

test("CSV import sends one summary with successful and skipped record counts", async () => {
  const ctx = setup();
  await ctx.request({ csv: "id,asset_name\n,New printer\n7,Existing printer\ninvalid,Bad printer" });
  assert.equal(ctx.alerts.length, 1);
  assert.equal(ctx.alerts[0].title, "สรุปการนำเข้าข้อมูล CSV");
  const details = ctx.alerts[0].details;
  assert.equal(details.จำนวนทั้งหมด, "3 record");
  assert.equal(details.นำเข้าสำเร็จ, "2 record");
  assert.equal(details.เพิ่มใหม่, "1 record");
  assert.equal(details.แก้ไข, "1 record");
  assert.equal(details.ข้ามหรือไม่สำเร็จ, "1 record");
  assert.equal(ctx.audits.length, 2);
  assert.ok(ctx.audits.every((entry) => entry.skipDataAlert));
});

test("CSV import reports zero successes when all records are rejected", async () => {
  const ctx = setup();
  await ctx.request({ csv: "id,asset_name\ninvalid,Bad printer" });
  assert.equal(ctx.alerts.length, 1);
  assert.equal(ctx.alerts[0].details.นำเข้าสำเร็จ, "0 record");
  assert.equal(ctx.alerts[0].details.ข้ามหรือไม่สำเร็จ, "1 record");
});
