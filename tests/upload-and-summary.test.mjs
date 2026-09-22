import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const storage = loadTs("lib/upload-storage.ts", {}, { process: { env: {}, cwd: () => "/srv/app" } });
const summary = loadTs("lib/daily-summary-format.ts", {}, { Number });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("asset photo storage lives outside public/ and only accepts plain image names", () => {
  assert.equal(storage.uploadRoot({}, "/srv/app"), "/srv/app/storage/uploads");
  assert.equal(storage.uploadRoot({ UPLOAD_DIR: "/data/uploads/" }, "/srv/app"), "/data/uploads");
  assert.equal(storage.assetImageDir({ UPLOAD_DIR: "/data/uploads" }, "/srv/app"), "/data/uploads/assets");
  assert.deepEqual(plain(storage.assetImageCandidates("asset-1-1-abc.jpg", {}, "/srv/app")), [
    "/srv/app/storage/uploads/assets/asset-1-1-abc.jpg",
    "/srv/app/public/uploads/assets/asset-1-1-abc.jpg",
  ]);
  for (const bad of ["../.env", "..%2f.env", "a/b.jpg", "x.svg", "x.jpg.exe", "", ".hidden.png", "a..b.png"]) {
    assert.equal(storage.safeAssetImageName(bad), null, bad);
    assert.equal(storage.assetImageCandidates(bad).length, 0);
  }
  assert.equal(storage.safeAssetImageName("asset-1726-2-9f1c.WEBP"), "asset-1726-2-9f1c.WEBP");
  assert.equal(storage.assetImageUrl("a.png"), "/uploads/assets/a.png");
  assert.equal(storage.assetImageContentType("a.JPG"), "image/jpeg");
  assert.equal(storage.assetImageContentType("a.webp"), "image/webp");
});

test("daily summary: thresholds, section formatting and the once-per-day key", () => {
  assert.deepEqual(plain(summary.summaryThresholdsFromEnv({ SUMMARY_WARRANTY_DAYS: "60", SUMMARY_REPAIR_OPEN_DAYS: "abc", SUMMARY_DISPOSAL_PENDING_DAYS: "0" })), {
    warrantyDays: 60, disposalPendingDays: 7, repairOpenDays: 14, inspectionWarnDays: 7,
  });
  const empty = { count: 0, items: [] };
  const data = {
    date: "2026-09-22",
    overdueLoans: { count: 7, items: Array.from({ length: 7 }, (_, i) => `NB-${i} โน้ตบุ๊ก (รพ.สต.ก) · ผู้ยืม ${i}`) },
    inspectionDeadlines: empty, expiringContracts: empty, pendingDisposals: empty, staleRepairs: empty,
  };
  assert.equal(summary.hasSummaryContent(data), true);
  assert.equal(summary.hasSummaryContent({ ...data, overdueLoans: empty }), false);
  const text = summary.formatSection(data.overdueLoans);
  const lines = text.split("\n");
  assert.equal(lines[0], "7 รายการ");
  assert.equal(lines.length, 7); // header + 5 items + "และอีก"
  assert.match(lines.at(-1), /และอีก 2 รายการ/);
  const long = summary.formatSection({ count: 50, items: Array.from({ length: 50 }, () => "ก".repeat(200)) });
  assert.ok(long.length <= 560, `field too long: ${long.length}`);
  assert.match(long, /และอีก 48 รายการ/);
  const details = summary.buildDailySummaryDetails(data);
  assert.equal(details["ยืมเกินกำหนดคืน"], text);
  assert.equal(details["งานซ่อมค้างเกิน 14 วัน"], "");
  assert.equal(summary.dailySummaryEventKey("2026-09-22"), "daily-summary:2026-09-22");
});
