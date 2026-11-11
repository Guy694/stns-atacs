import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { normalizePasswordLoginMode, effectivePasswordLoginMode, passwordLoginAllowedFor, validatePasswordLoginModeChange, PASSWORD_LOGIN_MODES } =
  loadTs("lib/password-login-policy.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("stored values: anything unknown means enabled for everyone", () => {
  assert.equal(normalizePasswordLoginMode("off"), "off");
  assert.equal(normalizePasswordLoginMode("admin-only"), "admin-only");
  assert.equal(normalizePasswordLoginMode("all"), "all");
  assert.equal(normalizePasswordLoginMode(null), "all");
  assert.equal(normalizePasswordLoginMode("garbage"), "all");
  assert.deepEqual(plain(PASSWORD_LOGIN_MODES.map((m) => m.key)), ["all", "admin-only", "off"]);
});

test("effective mode falls back to everyone when no other login works or the env override is on", () => {
  assert.deepEqual(plain(effectivePasswordLoginMode("off", { altLoginAvailable: true, forceOn: false })), { mode: "off", override: null });
  assert.deepEqual(plain(effectivePasswordLoginMode("off", { altLoginAvailable: false, forceOn: false })), { mode: "all", override: "no-alt-login" });
  assert.deepEqual(plain(effectivePasswordLoginMode("admin-only", { altLoginAvailable: false, forceOn: false })), { mode: "all", override: "no-alt-login" });
  assert.deepEqual(plain(effectivePasswordLoginMode("off", { altLoginAvailable: true, forceOn: true })), { mode: "all", override: "env" });
  assert.deepEqual(plain(effectivePasswordLoginMode("all", { altLoginAvailable: false, forceOn: false })), { mode: "all", override: null });
});

test("who may sign in with a password", () => {
  assert.equal(passwordLoginAllowedFor("all", "viewer"), true);
  assert.equal(passwordLoginAllowedFor("admin-only", "admin"), true);
  assert.equal(passwordLoginAllowedFor("admin-only", "officer"), false);
  assert.equal(passwordLoginAllowedFor("off", "admin"), false);
});

test("changes that could lock everyone out are refused", () => {
  const ok = { altLoginAvailable: true, actorHasExternalLogin: true };
  assert.equal(validatePasswordLoginModeChange("all", { altLoginAvailable: false, actorHasExternalLogin: false }), null);
  assert.equal(validatePasswordLoginModeChange("admin-only", ok), null);
  assert.equal(validatePasswordLoginModeChange("off", ok), null);
  assert.match(validatePasswordLoginModeChange("admin-only", { ...ok, altLoginAvailable: false }), /ThaiD|Google/);
  assert.match(validatePasswordLoginModeChange("off", { ...ok, altLoginAvailable: false }), /ThaiD|Google/);
  assert.match(validatePasswordLoginModeChange("off", { ...ok, actorHasExternalLogin: false }), /บัญชีของคุณ/);
  assert.equal(validatePasswordLoginModeChange("admin-only", { ...ok, actorHasExternalLogin: false }), null, "admins keep their password in admin-only");
});
