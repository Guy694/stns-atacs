import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The QR scanner (/scan and the inspection round page) needs the camera on our own origin.
// `camera=()` blocks it everywhere: getUserMedia fails at once and the browser never shows its permission prompt.
const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const policy = config.match(/key:\s*"Permissions-Policy",\s*value:\s*"([^"]+)"/)?.[1] ?? "";

test("Permissions-Policy allows the camera for our own origin only", () => {
  assert.ok(policy, "Permissions-Policy header is still set");
  assert.match(policy, /(^|,\s*)camera=\(self\)/);
  assert.doesNotMatch(policy, /camera=\(\)/);
  assert.doesNotMatch(policy, /camera=\*/);
});

test("other powerful features stay disabled", () => {
  for (const feature of ["microphone", "geolocation", "payment", "usb"]) {
    assert.match(policy, new RegExp(`${feature}=\\(\\)`), feature);
  }
});
