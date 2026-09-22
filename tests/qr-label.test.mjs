import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const label = loadTs("lib/qr-label.ts", {}, { Intl, Array, String });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Thai above/below marks take no width", () => {
  assert.equal(label.visibleLength("ที่"), 1);
  assert.equal(label.visibleLength("สตูล"), 3);
});

test("facility label: full name when it fits in two lines, abbreviated otherwise", () => {
  assert.deepEqual(plain(label.facilityLabelLines("โรงพยาบาลสตูล")), ["โรงพยาบาลสตูล"]);
  const long = label.facilityLabelLines("โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านทุ่งมะปรัง อำเภอควนกาหลง จังหวัดสตูล");
  assert.ok(long.length <= 2);
  assert.match(long[0], /^รพ\.สต\./);
  for (const line of long) assert.ok(label.visibleLength(line) <= 24);
  assert.deepEqual(plain(label.facilityLabelLines("")), []);
});

test("wrapLabel never exceeds the line count and marks cut text", () => {
  const lines = label.wrapLabel("เครื่องคอมพิวเตอร์ตั้งโต๊ะ สำหรับงานประมวลผลระดับสูง ยี่ห้อตัวอย่าง รุ่นทดสอบ", 28, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith("…"));
  assert.deepEqual(plain(label.wrapLabel("โต๊ะทำงาน", 28, 2)), ["โต๊ะทำงาน"]);
});
