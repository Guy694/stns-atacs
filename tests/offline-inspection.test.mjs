import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const offline = loadTs("lib/offline-inspection.ts", {}, { JSON, Number, Array });
const scan = loadTs("lib/asset-scan.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const entry = (clientId, itemId, extra = {}) => ({ clientId, itemId, assetId: itemId * 10, inspectionStatus: "Found", assetStatus: "", scannedAt: "2026-09-22T03:00:00.000Z", ...extra });

test("queue keeps the latest scan per item", () => {
  let queue = [];
  queue = offline.enqueueResult(queue, entry("a", 1));
  queue = offline.enqueueResult(queue, entry("b", 2));
  queue = offline.enqueueResult(queue, entry("c", 1, { assetStatus: "Broken" }));
  assert.deepEqual(plain(queue).map((item) => item.clientId), ["b", "c"]);
  assert.equal(offline.queueStorageKey(7), "atacs:inspection-queue:7");
});

test("after sync only retryable failures stay queued", () => {
  const queue = [entry("a", 1), entry("b", 2), entry("c", 3), entry("d", 4)];
  const rest = offline.remainingAfterSync(queue, [
    { clientId: "a", itemId: 1, ok: true },
    { clientId: "b", itemId: 2, ok: false, code: "closed" },
    { clientId: "c", itemId: 3, ok: false, code: "retry" },
  ]);
  assert.deepEqual(plain(rest).map((item) => item.clientId), ["c", "d"]);
});

test("stored/posted queue is validated and normalised", () => {
  assert.deepEqual(plain(offline.parseQueue("not json")), []);
  assert.deepEqual(plain(offline.parseQueue('{"a":1}')), []);
  const parsed = plain(offline.parseQueue(JSON.stringify([
    entry("ok", 5, { foundWorkGroupId: 12, foundLocation: "ห้อง 1", conditionNote: 5 }),
    entry("bad-status", 6, { inspectionStatus: "Maybe" }),
    { clientId: "no-item" },
    entry("group-null", 7, { foundWorkGroupId: null }),
    entry("group-junk", 8, { foundWorkGroupId: "x" }),
  ])));
  assert.deepEqual(parsed.map((item) => item.clientId), ["ok", "group-null", "group-junk"]);
  assert.equal(parsed[0].foundWorkGroupId, 12);
  assert.equal(parsed[0].conditionNote, "");
  assert.equal(parsed[1].foundWorkGroupId, null);
  assert.equal("foundWorkGroupId" in parsed[2], false);

  assert.match(offline.parseBatch({}).error, /ไม่มีผลตรวจ/);
  assert.match(offline.parseBatch({ results: [entry("a", 1), { clientId: "x" }] }).error, /ไม่ถูกต้อง/);
  assert.match(offline.parseBatch({ results: Array.from({ length: 101 }, (_, i) => entry(`k${i}`, i + 1)) }).error, /ไม่เกิน 100/);
  assert.equal(offline.parseBatch({ results: [entry("a", 1)] }).entries.length, 1);
});

test("QR payloads: asset page, scan page and the short sticker URL", () => {
  assert.equal(scan.assetIdFromScan("https://atacs.example.go.th/scan/assets/42"), 42);
  assert.equal(scan.assetIdFromScan("https://atacs.example.go.th/assets/42?x=1"), 42);
  assert.equal(scan.assetIdFromScan("https://atacs.example.go.th/q/42"), 42);
  assert.equal(scan.assetIdFromScan("https://example.com/qq/42"), null);
  assert.equal(scan.assetIdFromScan("hello"), null);
});
