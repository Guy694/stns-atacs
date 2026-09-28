import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const throttle = loadTs("lib/login-throttle.ts", {
  "@/lib/mysql": { selectRows: async () => [] },
  "@/lib/schema-errors": { isMissingSchemaError: (error) => error?.code === "ER_NO_SUCH_TABLE" },
});
const { evaluateLoginLock, loginLockMessage, loginLockPolicy } = throttle;

const policy = { windowMinutes: 15, maxPerAccount: 5, maxPerIp: 20 };

test("SEC-08: ล็อกบัญชีเมื่อใส่รหัสผ่านผิดถึงเพดาน", () => {
  assert.equal(evaluateLoginLock({ account: 4, ip: 4 }, policy).locked, false);
  const locked = evaluateLoginLock({ account: 5, ip: 5 }, policy);
  assert.equal(locked.locked, true);
  assert.equal(locked.scope, "account");
  assert.equal(locked.retryAfterMinutes, 15);
});

test("SEC-08: ล็อกทั้ง IP เมื่อไล่เดาหลายบัญชีจากที่เดียว", () => {
  const locked = evaluateLoginLock({ account: 1, ip: 20 }, policy);
  assert.equal(locked.locked, true);
  assert.equal(locked.scope, "ip");
});

test("ข้อความแจ้งผู้ใช้ต่างกันตามชนิดการล็อก และไม่มีข้อความเมื่อไม่ถูกล็อก", () => {
  assert.match(loginLockMessage(evaluateLoginLock({ account: 5, ip: 0 }, policy)), /บัญชีนี้/);
  assert.match(loginLockMessage(evaluateLoginLock({ account: 0, ip: 20 }, policy)), /เครือข่ายนี้/);
  assert.equal(loginLockMessage(evaluateLoginLock({ account: 0, ip: 0 }, policy)), null);
});

test("ค่านโยบายอ่านจาก env และกันค่าที่ต่ำเกินไป/ไม่ใช่ตัวเลข", () => {
  assert.deepEqual({ ...loginLockPolicy({}) }, { windowMinutes: 15, maxPerAccount: 5, maxPerIp: 20 });
  const custom = loginLockPolicy({ LOGIN_LOCK_WINDOW_MINUTES: "30", LOGIN_MAX_FAILURES_PER_ACCOUNT: "8", LOGIN_MAX_FAILURES_PER_IP: "50" });
  assert.equal(custom.windowMinutes, 30);
  assert.equal(custom.maxPerAccount, 8);
  assert.equal(custom.maxPerIp, 50);
  // ต่ำกว่าขั้นต่ำหรือไม่ใช่ตัวเลข → ใช้ค่าเริ่มต้น กันการตั้งค่าที่ล็อกผู้ใช้ทันที
  assert.equal(loginLockPolicy({ LOGIN_MAX_FAILURES_PER_ACCOUNT: "1" }).maxPerAccount, 5);
  assert.equal(loginLockPolicy({ LOGIN_MAX_FAILURES_PER_ACCOUNT: "ไม่ใช่ตัวเลข" }).maxPerAccount, 5);
});

test("ยังไม่มีตาราง security_events ต้องไม่ล็อกใครเลย", async () => {
  const noTable = loadTs("lib/login-throttle.ts", {
    "@/lib/mysql": { selectRows: async () => { const error = new Error("no table"); error.code = "ER_NO_SUCH_TABLE"; throw error; } },
    "@/lib/schema-errors": { isMissingSchemaError: (error) => error?.code === "ER_NO_SUCH_TABLE" },
  });
  const counts = await noTable.countRecentLoginFailures("someone", "1.1.1.1", policy);
  assert.equal(counts.available, false);
  assert.equal(counts.account, 0);
});
