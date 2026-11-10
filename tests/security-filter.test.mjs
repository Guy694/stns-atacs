import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { readSecurityFilter, SECURITY_WINDOWS } = loadTs("lib/security-filter.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("defaults to the last 7 days with no other filter", () => {
  assert.deepEqual(plain(readSecurityFilter({})), { days: 7 });
});

test("accepts known windows, groups, event types, IPs and trims search", () => {
  assert.deepEqual(plain(readSecurityFilter({ days: "30", group: "login", type: "login_failed_password", ip: "203.150.12.9", search: "  admin " })), {
    days: 30, group: "login", type: "login_failed_password", ip: "203.150.12.9", search: "admin",
  });
  assert.equal(readSecurityFilter({ ip: "2001:db8::1" }).ip, "2001:db8::1");
  assert.ok(plain(SECURITY_WINDOWS).includes(90));
});

test("drops anything malformed instead of passing it to SQL", () => {
  assert.deepEqual(plain(readSecurityFilter({ days: "9999", group: "drop table", type: "x' OR 1=1", ip: "1.2.3.4; --", search: "a".repeat(500) })), {
    days: 7, search: "a".repeat(100),
  });
  assert.deepEqual(plain(readSecurityFilter({ days: ["30", "1"], group: ["agent"] })), { days: 30, group: "agent" }, "array params use the first value");
});
