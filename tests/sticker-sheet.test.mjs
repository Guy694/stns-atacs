import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const sheet = loadTs("lib/sticker-sheet.ts", {}, { Number, Math, Array, Set });
const label = loadTs("lib/qr-label.ts", {}, { Intl, Array, String });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("every preset fits on A4 and keeps the QR inside the label", () => {
  for (const preset of sheet.STICKER_PRESETS) {
    const extent = sheet.gridExtent(preset);
    assert.ok(extent.width <= sheet.PAGE_WIDTH_MM + 0.01, `${preset.key} width ${extent.width}`);
    assert.ok(extent.height <= sheet.PAGE_HEIGHT_MM + 0.01, `${preset.key} height ${extent.height}`);
    assert.ok(preset.qrMm + 2 <= preset.heightMm, `${preset.key} QR taller than label`);
    assert.ok(preset.qrMm < preset.widthMm / 2 + 2, `${preset.key} leaves no room for text`);
  }
  assert.equal(sheet.perSheet(sheet.stickerPreset("mini")), 108);
  assert.equal(sheet.perSheet(sheet.stickerPreset("s65")), 65);
  assert.equal(sheet.stickerPreset("nope").key, "s65");
});

test("options are clamped and ids parsed safely", () => {
  const options = sheet.readStickerOptions({ size: "mini", skip: "500", copies: "9", dx: "-12", dy: "1.26", outline: "1" });
  assert.equal(options.preset.key, "mini");
  assert.equal(options.skip, 107);
  assert.equal(options.copies, 5);
  assert.equal(options.offsetXMm, -10);
  assert.equal(options.offsetYMm, 1.3);
  assert.equal(options.outline, true);
  assert.equal(sheet.readStickerOptions({ skip: "abc" }).skip, 0);
  assert.deepEqual(plain(sheet.parseIdList("5, 3,x,5,-1,0,7")), [5, 3, 7]);
  assert.deepEqual(plain(sheet.parseIdList(["1,2", "3"], 2)), [1, 2]);
});

test("pagination: skipped cells, copies and full pages", () => {
  const preset = sheet.stickerPreset("s21"); // 21 per sheet
  const pages = sheet.paginateStickers(["a", "b", "c"], preset, 20, 2);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].filter(Boolean).length, 1);
  assert.equal(pages[0][20], "a");
  assert.deepEqual(plain(pages[1].slice(0, 6)), ["a", "b", "b", "c", "c", null]);
  assert.equal(pages[1].length, 21);
  assert.equal(sheet.paginateStickers([], preset, 5).length, 0);
  assert.deepEqual(plain(sheet.cellPosition(preset, 4, 0.5, -1)), { left: 7.2 + 66 + 0.5, top: 15.1 + 38.1 - 1 });
});

test("QR payload and short facility names", () => {
  assert.equal(sheet.stickerQrUrl("https://atacs.go.th/", 12), "https://atacs.go.th/q/12");
  assert.equal(sheet.stickerQrUrl("https://atacs.go.th", 12, true), "HTTPS://ATACS.GO.TH/Q/12");
  assert.equal(label.shortFacilityName("โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านทุ่ง อำเภอควนกาหลง จังหวัดสตูล"), "รพ.สต.บ้านทุ่ง");
  assert.equal(label.shortFacilityName("สำนักงานสาธารณสุขจังหวัดสตูล"), "สสจ.สตูล");
  assert.equal(label.shortFacilityName("โรงพยาบาลละงู"), "รพ.ละงู");
});
