import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { decideReenroll, REENROLL_QUIET_DAYS } = loadTs("lib/agent-reenroll.ts");
const { cleanFingerprint } = loadTs("lib/agent-payload.ts");

const NOW = Date.parse("2026-11-09T12:00:00+07:00");
const daysAgo = (days) => new Date(NOW - days * 86_400_000).toISOString();
const device = (over = {}) => ({ isActive: true, uninstalledAt: null, lastSeenAt: daysAgo(0.1), lastReportedAt: daysAgo(0.1), ...over });

test("a fingerprint never seen before is a new enrolment", () => {
  assert.equal(decideReenroll(null, NOW), "new");
});

test("an active device that reported recently cannot be taken over by re-enrolling its fingerprint", () => {
  assert.equal(decideReenroll(device(), NOW), "blocked");
  assert.equal(decideReenroll(device({ lastReportedAt: null, lastSeenAt: daysAgo(REENROLL_QUIET_DAYS - 1) }), NOW), "blocked");
});

test("re-enrolment is allowed after the admin retired the device, ordered an uninstall, or the agent uninstalled itself", () => {
  assert.equal(decideReenroll(device({ isActive: false }), NOW), "reenroll");
  assert.equal(decideReenroll(device({ uninstalledAt: daysAgo(1) }), NOW), "reenroll");
  assert.equal(decideReenroll(device({ uninstallRequestedAt: daysAgo(1) }), NOW), "reenroll");
});

test("a device silent for longer than the quiet period may be reinstalled (reimaged machine)", () => {
  assert.equal(decideReenroll(device({ lastSeenAt: daysAgo(REENROLL_QUIET_DAYS + 1), lastReportedAt: daysAgo(REENROLL_QUIET_DAYS + 1) }), NOW), "reenroll");
});

test("the most recent of last report / last heartbeat decides, and missing timestamps count as silent", () => {
  assert.equal(decideReenroll(device({ lastReportedAt: daysAgo(30), lastSeenAt: daysAgo(1) }), NOW), "blocked");
  assert.equal(decideReenroll(device({ lastReportedAt: null, lastSeenAt: null }), NOW), "reenroll");
});

test("fingerprints must be the 64-char SHA-256 hex every agent version sends", () => {
  const sha = "a".repeat(64);
  assert.equal(cleanFingerprint(sha), sha);
  assert.equal(cleanFingerprint(sha.toUpperCase()), sha, "case-insensitive");
  for (const bad of ["abc", "a".repeat(63), "a".repeat(65), "g".repeat(64), "host-name.local", "0".repeat(64)]) {
    assert.equal(cleanFingerprint(bad), null, bad);
  }
});
