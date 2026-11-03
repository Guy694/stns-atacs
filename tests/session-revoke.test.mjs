import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

function setup(cookieToken) {
  const writes = [];
  const auth = loadTs("lib/auth.ts", {
    "node:crypto": { __esModule: true, default: crypto },
    "next/headers": { cookies: async () => ({ get: (name) => (cookieToken ? { name, value: cookieToken } : undefined) }) },
    "@/lib/mysql": {
      selectRows: async () => [],
      executeStatement: async (sql, values) => { writes.push({ sql, values }); return { affectedRows: 1 }; },
    },
    "@/lib/cookie-security": { secureCookiesEnabled: () => false },
    "@/lib/schema-errors": { isMissingSchemaError: (error) => error?.code === "ER_NO_SUCH_TABLE" },
  }, { process: { env: { AUTH_SECRET: "test-only", THAID_CID_ENCRYPTION_KEY: "ab".repeat(32) } } });
  return { auth, writes };
}

test("SEC-09: แอดมินรีเซ็ตรหัสผ่าน = ลบทุกเซสชันของผู้ใช้", async () => {
  const { auth, writes } = setup("current-token");
  const result = await auth.revokeUserSessions(42);
  assert.equal(result.revoked, true);
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /DELETE FROM auth_sessions WHERE user_id = \?$/);
  assert.deepEqual(Array.from(writes[0].values), [42]);
});

test("SEC-09: ผู้ใช้เปลี่ยนรหัสผ่านเอง = เครื่องอื่นหลุด แต่เครื่องที่ใช้อยู่ไม่หลุด", async () => {
  const { auth, writes } = setup("current-token");
  await auth.revokeUserSessions(42, { keepCurrent: true });
  assert.match(writes[0].sql, /session_token_hash <> \?/);
  const values = Array.from(writes[0].values);
  assert.equal(values[0], 42);
  // ค่าที่สองต้องเป็น hash ของ token ไม่ใช่ token ดิบ
  assert.notEqual(values[1], "current-token");
  assert.match(String(values[1]), /^[0-9a-f]{64}$/);
});

test("SEC-09: ไม่มี cookie ก็ยังลบเซสชันได้ทั้งหมด", async () => {
  const { auth, writes } = setup(null);
  await auth.revokeUserSessions(42, { keepCurrent: true });
  assert.match(writes[0].sql, /WHERE user_id = \?$/);
});

test("SEC-09: ยังไม่มีตาราง auth_sessions ต้องไม่ทำให้เปลี่ยนรหัสผ่านล้มเหลว", async () => {
  const auth = loadTs("lib/auth.ts", {
    "node:crypto": { __esModule: true, default: crypto },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/mysql": {
      selectRows: async () => [],
      executeStatement: async () => { const error = new Error("no table"); error.code = "ER_NO_SUCH_TABLE"; throw error; },
    },
    "@/lib/cookie-security": { secureCookiesEnabled: () => false },
    "@/lib/schema-errors": { isMissingSchemaError: (error) => error?.code === "ER_NO_SUCH_TABLE" },
  }, { process: { env: { AUTH_SECRET: "test-only", THAID_CID_ENCRYPTION_KEY: "ab".repeat(32) } } });
  assert.deepEqual({ ...(await auth.revokeUserSessions(42)) }, { revoked: false });
});

test("a session is refused after AUTH_SESSION_DAYS even when it is used often (idle refresh never extends it forever)", async () => {
  const reads = [];
  const auth = loadTs("lib/auth.ts", {
    "node:crypto": { __esModule: true, default: crypto },
    "next/headers": { cookies: async () => ({ get: (name) => ({ name, value: "tok" }) }) },
    "@/lib/mysql": { selectRows: async (sql, values) => { reads.push({ sql, values }); return []; }, executeStatement: async () => ({}) },
    "@/lib/cookie-security": { secureCookiesEnabled: () => false },
    "@/lib/schema-errors": { isMissingSchemaError: () => false },
  }, { process: { env: { AUTH_SECRET: "test-only", THAID_CID_ENCRYPTION_KEY: "ab".repeat(32) } } });
  assert.equal(await auth.getCurrentUser(), null);
  assert.match(reads[0].sql, /s\.created_at > DATE_SUB\(NOW\(\), INTERVAL \? DAY\)/);
  assert.equal(Array.from(reads[0].values)[1], 7);
});
