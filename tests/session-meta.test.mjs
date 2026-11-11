import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { loginMethodLabel, sessionStatus, sessionDeviceLabel, LOGIN_METHODS } = loadTs("lib/session-meta.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("login methods have Thai labels; unknown ones are shown as-is", () => {
  assert.deepEqual(plain(LOGIN_METHODS), ["password", "thaid", "google"]);
  assert.equal(loginMethodLabel("password"), "Username/Password");
  assert.equal(loginMethodLabel("thaid"), "ThaiD");
  assert.equal(loginMethodLabel("google"), "Google");
  assert.equal(loginMethodLabel(null), "ไม่ทราบ (ก่อนเริ่มบันทึก)");
});

test("session status: active while recently used, idle after 5 minutes, expired when past expiry", () => {
  const now = Date.parse("2026-11-11T10:00:00+07:00");
  assert.equal(sessionStatus({ lastSeenAt: "2026-11-11 09:58:00", expiresAt: "2026-11-11 10:13:00" }, now), "active");
  assert.equal(sessionStatus({ lastSeenAt: "2026-11-11 09:50:00", expiresAt: "2026-11-11 10:05:00" }, now), "idle");
  assert.equal(sessionStatus({ lastSeenAt: "2026-11-11 09:40:00", expiresAt: "2026-11-11 09:55:00" }, now), "expired");
  assert.equal(sessionStatus({ lastSeenAt: null, expiresAt: "2026-11-11 10:05:00" }, now), "idle", "sessions from before the migration have no last-seen time");
});

test("device label from the user agent", () => {
  assert.equal(sessionDeviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"), "คอมพิวเตอร์ · Windows · Chrome");
  assert.equal(sessionDeviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17 Mobile Safari/604.1"), "มือถือ · iOS · Safari");
  assert.equal(sessionDeviceLabel("Mozilla/5.0 (Linux; Android 14; SM-A546E) Chrome/130 Mobile Safari/537.36"), "มือถือ · Android · Chrome");
  assert.equal(sessionDeviceLabel(null), "ไม่ทราบอุปกรณ์");
});
