import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { errorFingerprint, firstAppFrame, redactErrorText } = loadTs("lib/error-fingerprint.ts");

test("redacts personal data and secrets before anything is sent out", () => {
  const text = redactErrorText("user 1234567890123 (a.b@x.go.th) from 10.0.0.8 token=abc123");
  assert.match(text, /\[เลขบัตร\]/);
  assert.match(text, /\[อีเมล\]/);
  assert.match(text, /\[ไอพี\]/);
  assert.match(text, /token=\[ซ่อน\]/);
  assert.doesNotMatch(text, /1234567890123|a\.b@x\.go\.th|10\.0\.0\.8|abc123/);
});

test("truncates very long text", () => {
  assert.equal(redactErrorText("x".repeat(1000), 20).length, 21);
});

test("picks the first frame that is not a dependency", () => {
  const stack = [
    "Error: boom",
    "    at Object.query (/app/node_modules/mysql2/lib/x.js:1:1)",
    "    at listAssets (/app/lib/assets.ts:120:5)",
  ].join("\n");
  assert.match(firstAppFrame(stack), /listAssets/);
  assert.equal(firstAppFrame(undefined), "");
});

test("the same failure at the same place shares a fingerprint, different places do not", () => {
  const stack = "Error: x\n    at listAssets (/app/lib/assets.ts:120:5)";
  const a = errorFingerprint({ name: "Error", message: "asset 12 not found", stack, where: "assets" });
  const b = errorFingerprint({ name: "Error", message: "asset 987 not found", stack, where: "assets" });
  const c = errorFingerprint({ name: "Error", message: "asset 12 not found", stack, where: "reports" });
  assert.equal(a, b, "ตัวเลขที่ต่างกันต้องไม่ทำให้กลายเป็นคนละข้อผิดพลาด");
  assert.notEqual(a, c);
});
