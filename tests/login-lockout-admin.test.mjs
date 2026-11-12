import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { lockReleaseAt, summarizeLockedLogins, justReachedLock, LOGIN_UNLOCK_EVENT, LOGIN_IP_UNLOCK_EVENT } = loadTs("lib/login-lockout.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const policy = { windowMinutes: 15, maxPerAccount: 5, maxPerIp: 20 };
const at = (hhmm) => `2026-11-11 ${hhmm}:00`;

test("unlock events are distinct event types", () => {
  assert.equal(LOGIN_UNLOCK_EVENT, "login_unlocked");
  assert.equal(LOGIN_IP_UNLOCK_EVENT, "login_ip_unlocked");
});

test("sliding window: the lock lifts when the oldest failure that keeps it locked leaves the window", () => {
  // 6 failures, max 5 → still locked until the 2nd one (index n-max = 1) is 15 minutes old
  const failures = ["09:00", "09:02", "09:03", "09:04", "09:05", "09:06"].map(at);
  assert.equal(lockReleaseAt(failures, 5, 15), "2026-11-11 09:17:00");
  assert.equal(lockReleaseAt(failures.slice(0, 4), 5, 15), null, "below the limit = not locked");
});

test("lists only locked accounts and IPs, with when they unlock", () => {
  const now = Date.parse("2026-11-11T09:10:00+07:00");
  const result = summarizeLockedLogins(
    {
      accounts: [
        { identity: "somchai", exists: true, displayName: "สมชาย ใจดี", failures: ["09:00", "09:01", "09:02", "09:03", "09:04"].map(at), ips: ["1.2.3.4"] },
        { identity: "admin", exists: false, displayName: null, failures: ["09:05", "09:06"].map(at), ips: ["5.6.7.8"] },
        // locked but already released by time
        { identity: "old", exists: true, displayName: "เก่า", failures: ["08:00", "08:01", "08:02", "08:03", "08:04"].map(at), ips: [] },
      ],
      ips: [{ ip: "9.9.9.9", failures: Array.from({ length: 20 }, () => at("09:05")), identities: ["a", "b"] }],
    },
    policy,
    now
  );
  assert.deepEqual(plain(result.accounts), [
    { identity: "somchai", exists: true, displayName: "สมชาย ใจดี", failures: 5, ips: ["1.2.3.4"], releaseAt: "2026-11-11 09:15:00", minutesLeft: 5 },
  ]);
  assert.deepEqual(plain(result.ips), [{ ip: "9.9.9.9", failures: 20, identities: ["a", "b"], releaseAt: "2026-11-11 09:20:00", minutesLeft: 10 }]);
});

test("alert exactly once: when the failure count first reaches the limit", () => {
  assert.equal(justReachedLock({ account: 4, ip: 4 }, policy), null);
  assert.equal(justReachedLock({ account: 5, ip: 5 }, policy), "account");
  assert.equal(justReachedLock({ account: 6, ip: 6 }, policy), null, "already locked: no repeat alert");
  assert.equal(justReachedLock({ account: 1, ip: 20 }, policy), "ip");
});
