import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { passwordPolicyError, PASSWORD_MIN_LENGTH } = loadTs("lib/password-policy.ts");

test("one policy everywhere: at least 10 characters with letters and digits", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 10);
  assert.match(passwordPolicyError("Abc12345"), /10/);
  assert.match(passwordPolicyError("abcdefghijk"), /ตัวอักษรและตัวเลข/);
  assert.match(passwordPolicyError("12345678901"), /ตัวอักษรและตัวเลข/);
  assert.equal(passwordPolicyError("Satun2026ok"), null);
});

test("rejects passwords containing the username and very common ones", () => {
  assert.match(passwordPolicyError("nakharin2026", { username: "nakharin" }), /ชื่อผู้ใช้/);
  assert.match(passwordPolicyError("Password1234"), /คาดเดาง่าย/);
  assert.match(passwordPolicyError("qwerty123456"), /คาดเดาง่าย/);
  assert.equal(passwordPolicyError("Satun2026ok", { username: "nakharin" }), null);
});

test("every place that sets a password uses the shared policy", async () => {
  const { readFileSync } = await import("node:fs");
  for (const file of ["app/(main)/admin/users/actions.ts", "app/(main)/profile/actions.ts", "lib/auth.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /passwordPolicyError/, file);
    assert.doesNotMatch(source, /[pP]assword\.length < (8|10)\)/, `${file} still has its own length rule`);
  }
});
