import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const guards = loadTs("lib/input-guards.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("B5: safeNextPath keeps normal in-app paths", () => {
  assert.equal(guards.safeNextPath("/assets/12/?tab=info"), "/assets/12/?tab=info");
  assert.equal(guards.safeNextPath("/dashboard"), "/dashboard");
  assert.equal(guards.safeNextPath("/inspection/3/#item-4"), "/inspection/3/#item-4");
});

test("B5: safeNextPath rejects open-redirect tricks", () => {
  const nasty = [
    null, undefined, "", "dashboard", "https://evil.com", "//evil.com", "///evil.com", "/\\evil.com", "\\\\evil.com",
    "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", " /evil", "/ /evil.com", "/%09/evil.com".replace("%09", "\u0009"),
    "/\u0000/evil.com", "/\u00a0/evil.com", "/\u2028/evil.com", "/x\u007f", "javascript:alert(1)", "/./\\evil.com",
  ];
  for (const value of nasty) assert.equal(guards.safeNextPath(value), "/dashboard", JSON.stringify(value));
  assert.equal(guards.safeNextPath(new File([], "x")), "/dashboard");
  assert.equal(guards.safeNextPath("//evil.com", "/home"), "/home");
});

test("B5: safeNextPath never yields a path a browser reads as protocol-relative", () => {
  // "/.//evil.com" resolves to "//evil.com" in URL parsing.
  assert.equal(guards.safeNextPath("/.//evil.com"), "/dashboard");
  assert.equal(guards.safeNextPath("/a/..//evil.com"), "/dashboard");
});

test("B6: profile email is normalised and validated", () => {
  assert.deepEqual(plain(guards.normalizeProfileEmail("  Someone@MOPH.go.th ")), { email: "someone@moph.go.th", error: null });
  assert.deepEqual(plain(guards.normalizeProfileEmail("")), { email: null, error: null });
  assert.deepEqual(plain(guards.normalizeProfileEmail(null)), { email: null, error: null });
  for (const bad of ["no-at", "a@b", "a b@c.com", "a@@c.com", "@c.com", "a@c.com\n", `${"a".repeat(250)}@c.com`]) {
    assert.ok(guards.normalizeProfileEmail(bad).error, bad);
  }
});

test("B6: duplicate-key errors are recognised", () => {
  assert.equal(guards.isDuplicateEntryError({ code: "ER_DUP_ENTRY" }), true);
  assert.equal(guards.isDuplicateEntryError({ errno: 1062 }), true);
  assert.equal(guards.isDuplicateEntryError(new Error("x")), false);
  assert.equal(guards.isDuplicateEntryError(null), false);
});

test("B7: offline scan time is formatted on the Bangkok clock and validated", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  assert.equal(guards.formatOfflineScanTime("2026-11-05T01:02:03.000Z", now), "2026-11-05 08:02:03");
  assert.equal(guards.formatOfflineScanTime("2026-11-04T20:30:00Z", now), "2026-11-05 03:30:00");
  assert.equal(guards.formatOfflineScanTime("not a date", now), null);
  assert.equal(guards.formatOfflineScanTime("", now), null);
  assert.equal(guards.formatOfflineScanTime("1999-01-01T00:00:00Z", now), null);
  assert.equal(guards.formatOfflineScanTime("2026-11-07T00:00:00Z", now), null);
  assert.equal(guards.offlineScanAuditNote("2026-11-05T01:02:03Z", now), "สแกนออฟไลน์ 2026-11-05 08:02:03");
  assert.equal(guards.offlineScanAuditNote("garbage", now), "สแกนออฟไลน์ (เวลาจากเครื่องไม่ถูกต้อง)");
});

test("B8: client error body must be an object of strings, capped", () => {
  assert.equal(guards.parseClientErrorBody(null), null);
  assert.equal(guards.parseClientErrorBody([]), null);
  assert.equal(guards.parseClientErrorBody("x"), null);
  assert.equal(guards.parseClientErrorBody({ message: 1 }), null);
  assert.equal(guards.parseClientErrorBody({ digest: {} }), null);
  assert.equal(guards.parseClientErrorBody({ path: 5 }), null);
  const parsed = guards.parseClientErrorBody({ message: "m".repeat(2000), name: "n".repeat(300), where: "w".repeat(80), digest: "d".repeat(200), path: null });
  assert.equal(parsed.message.length, 500);
  assert.equal(parsed.name.length, 100);
  assert.equal(parsed.where.length, 50);
  assert.equal(parsed.digest.length, 100);
  assert.equal(parsed.path, null);
  assert.deepEqual(plain(guards.parseClientErrorBody({})), { message: "", name: "Error", where: "unknown", digest: "-", path: null });
});

test("B9: asset photo route never decodes the param a second time", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../app/uploads/assets/[file]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /decodeURIComponent\(/);
  const storage = loadTs("lib/upload-storage.ts", {}, { process });
  assert.equal(storage.safeAssetImageName("%"), null);
  assert.equal(storage.safeAssetImageName("%2e%2e%2fsecret"), null);
  assert.equal(storage.safeAssetImageName("../secret.jpg"), null);
});

const roles = loadTs("lib/role-permissions.ts", {
  "@/lib/mysql": { selectRows: async () => [], executeStatement: async () => ({}) },
});

test("B13: only known roles and permission keys are accepted", () => {
  assert.equal(roles.isValidRolePermission("officer", "assets.view"), true);
  assert.equal(roles.isValidRolePermission("superuser", "assets.view"), false);
  assert.equal(roles.isValidRolePermission("officer", "assets.everything"), false);
  assert.equal(roles.isValidRolePermission("officer", "__proto__"), false);
});

test("B13: upsertRolePermission refuses unknown keys before touching the DB", async () => {
  const writes = [];
  const scoped = loadTs("lib/role-permissions.ts", {
    "@/lib/mysql": { selectRows: async () => [], executeStatement: async (sql, values) => { writes.push(values); return {}; } },
  });
  await assert.rejects(scoped.upsertRolePermission({ role: "officer", permission: "made.up", isAllowed: true }));
  await assert.rejects(scoped.upsertRolePermission({ role: "root", permission: "assets.view", isAllowed: true }));
  assert.equal(writes.length, 0);
  await scoped.upsertRolePermission({ role: "officer", permission: "assets.view", isAllowed: true });
  assert.equal(writes.length, 1);
});

test("B12: admins cannot change their own role or demote the last active admin", () => {
  const block = roles.roleChangeBlockReason;
  assert.ok(block({ actorId: 1, targetId: 1, currentRole: "admin", newRole: "viewer", otherActiveAdmins: 3 }));
  assert.equal(block({ actorId: 1, targetId: 1, currentRole: "admin", newRole: "admin", otherActiveAdmins: 0 }), null);
  assert.ok(block({ actorId: 1, targetId: 2, currentRole: "admin", newRole: "officer", otherActiveAdmins: 0 }));
  assert.equal(block({ actorId: 1, targetId: 2, currentRole: "admin", newRole: "officer", otherActiveAdmins: 1 }), null);
  assert.equal(block({ actorId: 1, targetId: 2, currentRole: "viewer", newRole: "admin", otherActiveAdmins: 0 }), null);
  assert.equal(block({ actorId: "1", targetId: 1, currentRole: "officer", newRole: "officer", otherActiveAdmins: 0 }), null);
});

const label = loadTs("lib/qr-label.ts", {}, { Intl, Array, String });

test("S1: QR scan URL uses the public app URL and includes the base path exactly once", () => {
  const url = label.assetScanUrl;
  assert.equal(url(7, { appUrl: "https://ex.go.th/stns-atacs", basePath: "/stns-atacs", requestOrigin: "http://127.0.0.1:3000" }), "https://ex.go.th/stns-atacs/scan/assets/7/");
  assert.equal(url(7, { appUrl: "https://ex.go.th/stns-atacs/", basePath: "/stns-atacs", requestOrigin: "http://127.0.0.1:3000" }), "https://ex.go.th/stns-atacs/scan/assets/7/");
  assert.equal(url(7, { appUrl: "https://ex.go.th", basePath: "/stns-atacs", requestOrigin: "http://127.0.0.1:3000" }), "https://ex.go.th/stns-atacs/scan/assets/7/");
  assert.equal(url(7, { appUrl: "", basePath: "/stns-atacs", requestOrigin: "https://public.example" }), "https://public.example/stns-atacs/scan/assets/7/");
  assert.equal(url(7, { appUrl: undefined, basePath: "", requestOrigin: "http://localhost:3000" }), "http://localhost:3000/scan/assets/7/");
  assert.equal(url(7, { appUrl: "not a url", basePath: "", requestOrigin: "https://public.example/" }), "https://public.example/scan/assets/7/");
  assert.equal(url(7, { appUrl: "ftp://ex.go.th", basePath: "", requestOrigin: "https://public.example" }), "https://public.example/scan/assets/7/");
});

import crypto from "node:crypto";

function authWith(selectRows) {
  return loadTs("lib/auth.ts", {
    "node:crypto": { __esModule: true, default: crypto },
    "next/headers": { cookies: async () => ({ get: (name) => ({ name, value: "tok" }) }) },
    "@/lib/mysql": { selectRows, executeStatement: async () => ({}) },
    "@/lib/cookie-security": { secureCookiesEnabled: () => false },
    "@/lib/schema-errors": { isMissingSchemaError: (error) => error?.code === "ER_BAD_FIELD_ERROR" },
  }, { process: { env: { AUTH_SECRET: "test-only", THAID_CID_ENCRYPTION_KEY: "ab".repeat(32) } } });
}

test("B14: session lookup rethrows real DB errors instead of silently retrying", async () => {
  let calls = 0;
  const auth = authWith(async () => { calls += 1; const error = new Error("connection lost"); error.code = "PROTOCOL_CONNECTION_LOST"; throw error; });
  await assert.rejects(auth.getCurrentUser(), /connection lost/);
  assert.equal(calls, 1);
});

test("B14: session lookup falls back only when users.facility_id is missing", async () => {
  const sqls = [];
  const auth = authWith(async (sql) => {
    sqls.push(sql);
    if (sqls.length === 1) { const error = new Error("Unknown column"); error.code = "ER_BAD_FIELD_ERROR"; throw error; }
    return [];
  });
  assert.equal(await auth.getCurrentUser(), null);
  assert.equal(sqls.length, 2);
  assert.doesNotMatch(sqls[1], /facility_id/);
});
