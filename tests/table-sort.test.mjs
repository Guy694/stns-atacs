import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const t = loadTs("lib/table-sort.ts", {}, { Math, Number, String, Array, Object, Intl, URLSearchParams });

test("readSort accepts only whitelisted keys and falls back otherwise", () => {
  assert.deepEqual({ ...t.readSort({ sort: "name", dir: "desc" }, ["name", "date"]) }, { key: "name", dir: "desc" });
  assert.deepEqual({ ...t.readSort({ sort: "name" }, ["name"]) }, { key: "name", dir: "asc" });
  assert.equal(t.readSort({ sort: "password_hash" }, ["name"]), null);
  assert.deepEqual({ ...t.readSort({}, ["name"], { key: "date", dir: "desc" }) }, { key: "date", dir: "desc" });
  // A second table on the same page uses its own prefix.
  assert.deepEqual({ ...t.readSort({ sort: "name", hsort: "date", hdir: "desc" }, ["date"], null, "h") }, { key: "date", dir: "desc" });
});

test("sortHref toggles direction on the active column, resets the page and keeps other filters", () => {
  const params = { status: "Open", page: "3", sort: "name", dir: "asc" };
  assert.equal(t.sortHref("/repairs", params, "name", { key: "name", dir: "asc" }), "/repairs?status=Open&sort=name&dir=desc");
  assert.equal(t.sortHref("/repairs", params, "date", { key: "name", dir: "asc" }), "/repairs?status=Open&sort=date&dir=asc");
  assert.equal(t.sortHref("/loans", { sort: "x", hpage: "2" }, "due", null, "h"), "/loans?sort=x&hsort=due&hdir=asc");
});

test("pageHref sets the page and drops page 1", () => {
  assert.equal(t.pageHref("/repairs", { status: "Open", page: "3" }, 1), "/repairs?status=Open");
  assert.equal(t.pageHref("/repairs", { status: "Open" }, 4), "/repairs?status=Open&page=4");
  assert.equal(t.pageHref("/loans", { page: "2" }, 2, "h"), "/loans?page=2&hpage=2");
});

test("sortRows compares Thai text, numbers and dates, keeping blanks last in both directions", () => {
  const rows = [
    { name: "ข", n: 10, d: "2026-01-02" },
    { name: "ก", n: 9, d: "" },
    { name: "ค", n: null, d: "2025-12-31" },
  ];
  const by = { name: (r) => r.name, n: (r) => r.n, d: (r) => r.d };
  assert.deepEqual(t.sortRows(rows, { key: "name", dir: "asc" }, by).map((r) => r.name), ["ก", "ข", "ค"]);
  assert.deepEqual(t.sortRows(rows, { key: "n", dir: "asc" }, by).map((r) => r.n), [9, 10, null]);
  assert.deepEqual(t.sortRows(rows, { key: "n", dir: "desc" }, by).map((r) => r.n), [10, 9, null]);
  assert.deepEqual(t.sortRows(rows, { key: "d", dir: "desc" }, by).map((r) => r.d), ["2026-01-02", "2025-12-31", ""]);
  // Unknown key or no sort keeps the original order and never mutates the input.
  assert.deepEqual(Array.from(t.sortRows(rows, null, by), (r) => r.name), ["ข", "ก", "ค"]);
  assert.equal(rows[0].name, "ข");
});

test("paginate clamps the page and reports the visible range", () => {
  const rows = Array.from({ length: 53 }, (_, i) => i + 1);
  const p = t.paginate(rows, 3, 25);
  assert.deepEqual([p.page, p.totalPages, p.total, p.start, p.end, p.rows.length], [3, 3, 53, 51, 53, 3]);
  const over = t.paginate(rows, 99, 25);
  assert.equal(over.page, 3);
  const empty = t.paginate([], 1, 25);
  assert.deepEqual([empty.page, empty.totalPages, empty.start, empty.end], [1, 1, 0, 0]);
});

test("pageWindow shows first, last and neighbours with gaps marked as 0", () => {
  assert.deepEqual(Array.from(t.pageWindow(1, 1)), [1]);
  assert.deepEqual(Array.from(t.pageWindow(5, 10)), [1, 0, 4, 5, 6, 0, 10]);
  assert.deepEqual(Array.from(t.pageWindow(2, 4)), [1, 2, 3, 4]);
});

test("readPage reads a positive integer and defaults to 1", () => {
  assert.equal(t.readPage({ page: "4" }), 4);
  assert.equal(t.readPage({ page: "-2" }), 1);
  assert.equal(t.readPage({ page: "abc" }), 1);
  assert.equal(t.readPage({ hpage: "2" }, "h"), 2);
});
