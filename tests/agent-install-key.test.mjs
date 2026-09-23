import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

function load(installKeyEnv) {
  return loadTs(
    "lib/agent-install-key.ts",
    { "node:crypto": { __esModule: true, default: crypto } },
    { process: { env: { ATACS_AGENT_INSTALL_KEY: installKeyEnv } } }
  );
}

test("SEC-03: a facility-bound key only enrolls that facility", () => {
  const keys = load("12:KEY-TWELVE,34:KEY-THIRTYFOUR");
  assert.equal(keys.verifyAgentInstallKey("KEY-TWELVE", 12), true);
  assert.equal(keys.verifyAgentInstallKey("KEY-TWELVE", 34), false);
  assert.equal(keys.verifyAgentInstallKey("KEY-TWELVE"), false, "must not pass without a facility");
  assert.equal(keys.verifyAgentInstallKey("KEY-THIRTYFOUR", 34), true);
  assert.equal(keys.verifyAgentInstallKey("WRONG", 12), false);
});

test("SEC-03: a bare key stays global for backward compatibility", () => {
  const keys = load("LEGACY-GLOBAL");
  assert.equal(keys.verifyAgentInstallKey("LEGACY-GLOBAL", 12), true);
  assert.equal(keys.verifyAgentInstallKey("LEGACY-GLOBAL", 99), true);
  assert.equal(keys.getPrimaryAgentInstallKey(), "LEGACY-GLOBAL");
});

test("SEC-03: a facility-scoped admin never sees the global key", () => {
  const keys = load("GLOBAL-KEY,12:KEY-TWELVE");
  assert.equal(keys.getFacilityBoundAgentInstallKey(12), "KEY-TWELVE");
  assert.equal(keys.getFacilityBoundAgentInstallKey(34), null, "no bound key must not fall back to the global one");
  assert.equal(keys.getAgentInstallKeyForFacility(34), "GLOBAL-KEY");
});

test("SEC-03: no key configured means nothing verifies", () => {
  const keys = load("");
  assert.equal(keys.isAgentInstallKeyConfigured(), false);
  assert.equal(keys.getPrimaryAgentInstallKey(), null);
  assert.equal(keys.verifyAgentInstallKey("anything", 1), false);
  assert.equal(keys.verifyAgentInstallKey("", 1), false);
});
