import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const lib = loadTs("lib/inspection-progress.ts", {}, { Math, Number, String });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("working days skip weekends; 30 working days after a Monday lands six weeks later", () => {
  assert.equal(lib.addWorkingDays("2026-10-05", 1), "2026-10-06"); // Mon -> Tue
  assert.equal(lib.addWorkingDays("2026-10-09", 1), "2026-10-12"); // Fri -> Mon
  assert.equal(lib.addWorkingDays("2026-10-10", 1), "2026-10-12"); // Sat -> Mon
  assert.equal(lib.addWorkingDays("2026-10-05", 30), "2026-11-16");
  assert.equal(lib.addWorkingDays("bad", 3), "");
});

test("deadline state follows the report deadline and round status", () => {
  const round = { startDate: "2026-10-05", roundStatus: "Open" };
  assert.deepEqual(plain(lib.inspectionDeadline(round, "2026-10-20")), { dueDate: "2026-11-16", daysLeft: 27, state: "on-track" });
  assert.equal(lib.inspectionDeadline(round, "2026-11-10").state, "due-soon");
  assert.equal(lib.inspectionDeadline(round, "2026-11-17").state, "overdue");
  assert.equal(lib.inspectionDeadline({ ...round, roundStatus: "Closed" }, "2026-12-31").state, "closed");
  assert.equal(lib.inspectionDeadline({ startDate: "", roundStatus: "Open" }).state, "no-date");
});

test("progress stages and totals per facility", () => {
  const row = (facilityId, extra) => ({ facilityId, facilityName: `หน่วย ${facilityId}`, districtName: "เมือง", assets: 10, covered: 0, checked: 0, found: 0, missing: 0, openRounds: 0, closedRounds: 0, ...extra });
  const rows = [
    row(1),
    row(2, { covered: 10, checked: 4, found: 3, missing: 1, openRounds: 1 }),
    row(3, { covered: 10, checked: 10, found: 10, openRounds: 1 }),
    row(4, { covered: 6, checked: 6, found: 6, closedRounds: 1 }),
    row(5, { covered: 10, checked: 10, found: 9, missing: 1, closedRounds: 2 }),
  ];
  assert.deepEqual(rows.map((r) => lib.progressStage(r)), ["not-started", "in-progress", "checked", "partial", "closed"]);
  const summary = lib.summarizeInspectionProgress(rows);
  assert.equal(summary.totals.assets, 50);
  assert.equal(summary.totals.checked, 30);
  assert.equal(summary.totals.uncovered, 14);
  assert.equal(summary.totals.checkedRate, 0.6);
  assert.deepEqual(plain(summary.stageCounts), { "not-started": 1, "in-progress": 1, checked: 1, partial: 1, closed: 1 });
  // least progress first
  assert.equal(summary.facilities[0].facilityId, 1);
});
