import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { escapeCsvValue, toCsv } = loadTs("lib/csv.ts");

test("SEC-12: neutralises values a spreadsheet would run as a formula", () => {
  for (const dangerous of ['=HYPERLINK("http://x","c")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd", "   =1+1"]) {
    const escaped = escapeCsvValue(dangerous);
    assert.ok(escaped.startsWith(`"'`), `${JSON.stringify(dangerous)} → ${escaped}`);
  }
});

test("leaves ordinary values alone and still quotes what CSV requires", () => {
  assert.equal(escapeCsvValue("คอมพิวเตอร์"), "คอมพิวเตอร์");
  assert.equal(escapeCsvValue(1500.5), "1500.5");
  assert.equal(escapeCsvValue(null), "");
  assert.equal(escapeCsvValue("a,b"), '"a,b"');
  assert.equal(escapeCsvValue('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvValue("line\nbreak"), '"line\nbreak"');
});

test("builds a CSV with a BOM so Excel reads Thai correctly", () => {
  const csv = toCsv([["ชื่อ", "ราคา"], ["โต๊ะ", 1200]]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv, "﻿ชื่อ,ราคา\r\nโต๊ะ,1200");
  assert.equal(toCsv([["a"]], { bom: false }), "a");
});
