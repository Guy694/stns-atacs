import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const shared = loadTs("lib/announcement-shared.ts");
const version = loadTs("lib/app-version.ts");

test("ข้อความประกาศถูกแบ่งเป็นชิ้น ≤255 ตัวอักษรและประกอบกลับได้ครบ", () => {
  const text = "ก".repeat(900);
  const chunks = shared.splitAnnouncementMessage(text);
  assert.equal(chunks.length, shared.ANNOUNCEMENT_CHUNK_COUNT);
  assert.ok(chunks.every((chunk) => chunk.length <= 255));
  assert.equal(shared.joinAnnouncementMessage(chunks), text);
});

test("ข้อความที่ยาวเกินกำหนดถูกตัดที่ขีดจำกัด", () => {
  const chunks = shared.splitAnnouncementMessage("x".repeat(5000));
  assert.equal(shared.joinAnnouncementMessage(chunks).length, shared.ANNOUNCEMENT_MESSAGE_MAX);
});

test("popup แสดงเมื่อเปิดใช้งานและมีเนื้อหาเท่านั้น", () => {
  const base = { enabled: true, title: "", version: "", message: "", imageName: "", revision: "1", updatedAt: "", updatedBy: "" };
  assert.equal(shared.isAnnouncementVisible(base), false);
  assert.equal(shared.isAnnouncementVisible({ ...base, title: "อัปเดต" }), true);
  assert.equal(shared.isAnnouncementVisible({ ...base, title: "อัปเดต", enabled: false }), false);
});

test("ตรวจชนิดภาพจาก byte จริง ไม่เชื่อนามสกุลหรือ Content-Type", () => {
  assert.equal(shared.detectImageExtension(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(shared.detectImageExtension(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(shared.detectImageExtension(new TextEncoder().encode("RIFF0000WEBPVP8 ")), "webp");
  assert.equal(shared.detectImageExtension(new TextEncoder().encode("<svg onload=alert(1)>")), null);
});

test("เวอร์ชันระบบเป็น v.1.0.0 และตรงกับ package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(version.APP_VERSION, "1.0.0");
  assert.equal(version.APP_VERSION_LABEL, "v.1.0.0");
  assert.equal(pkg.version, version.APP_VERSION);
});
