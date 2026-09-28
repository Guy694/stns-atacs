import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { readRequestIp } = loadTs("lib/security.ts", {
  "@/lib/mysql": { selectRows: async () => [], executeStatement: async () => ({}) },
  "@/lib/telegram": { notifyTelegramSafe: async () => ({ sent: false }) },
});

const req = (forwarded, realIp) => new Headers({
  ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
  ...(realIp ? { "x-real-ip": realIp } : {}),
});

test("SEC-08: ไคลเอนต์ปลอม X-Forwarded-For ไม่ได้เมื่อระบุจำนวนชั้น proxy", () => {
  // ผู้ใช้จริง 203.0.113.9 ปลอมค่านำหน้ามาเอง แล้วผ่าน proxy 2 ชั้น
  const spoofed = req("1.1.1.1, 203.0.113.9, 10.0.0.2", null);
  assert.equal(readRequestIp(spoofed, { TRUSTED_PROXY_COUNT: "2" }), "203.0.113.9");
});

test("SEC-08: proxy ชั้นเดียวและสองชั้นอ่านค่าได้ถูกต้อง", () => {
  assert.equal(readRequestIp(req("203.0.113.9"), { TRUSTED_PROXY_COUNT: "1" }), "203.0.113.9");
  assert.equal(readRequestIp(req("203.0.113.9, 10.0.0.2"), { TRUSTED_PROXY_COUNT: "2" }), "203.0.113.9");
});

test("SEC-08: ไม่ตั้งค่า = ใช้ hop ที่ใกล้ที่สุด ไม่เชื่อค่าที่ปลอมได้", () => {
  assert.equal(readRequestIp(req("1.1.1.1, 10.0.0.2"), {}), "10.0.0.2");
  assert.equal(readRequestIp(req("1.1.1.1, 10.0.0.2"), { TRUSTED_PROXY_COUNT: "0" }), "10.0.0.2");
  assert.equal(readRequestIp(req("1.1.1.1, 10.0.0.2"), { TRUSTED_PROXY_COUNT: "ไม่ใช่ตัวเลข" }), "10.0.0.2");
});

test("SEC-08: ตั้งชั้นเกินจริงยังคืนค่าแรกสุด ไม่ crash", () => {
  assert.equal(readRequestIp(req("203.0.113.9"), { TRUSTED_PROXY_COUNT: "5" }), "203.0.113.9");
});

test("ไม่มี X-Forwarded-For ใช้ x-real-ip และไม่มีทั้งคู่คืน unknown", () => {
  assert.equal(readRequestIp(req(null, "203.0.113.9"), { TRUSTED_PROXY_COUNT: "2" }), "203.0.113.9");
  assert.equal(readRequestIp(req(null, null), {}), "unknown");
});
