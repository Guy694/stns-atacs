import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const XLSX = createRequire(import.meta.url)("xlsx");
const loans = loadTs("lib/loan-options.ts", {}, { Math, Number, String });
const report = loadTs("lib/disposal-report.ts", {}, { URLSearchParams, Intl, Math, Number, String, Buffer });

test("loan state follows the due date and status", () => {
  const loan = { status: "OnLoan", dueOn: "2026-10-10" };
  assert.equal(loans.loanState(loan, "2026-10-01").state, "on-loan");
  assert.equal(loans.loanState(loan, "2026-10-08").state, "due-soon");
  assert.equal(loans.loanState(loan, "2026-10-12").state, "overdue");
  assert.equal(loans.loanState(loan, "2026-10-12").daysLeft, -2);
  assert.equal(loans.loanState({ ...loan, status: "Returned" }, "2026-12-01").state, "returned");
});

test("loan input validation", () => {
  const base = { borrowerName: " นางสาวตัวอย่าง ", purpose: "ออกหน่วย", loanedOn: "2026-10-01", dueOn: "2026-10-08" };
  assert.equal(loans.validateLoanInput(base, "2026-10-02").borrowerName, "นางสาวตัวอย่าง");
  assert.throws(() => loans.validateLoanInput({ ...base, borrowerName: "" }, "2026-10-02"), /ชื่อผู้ยืม/);
  assert.throws(() => loans.validateLoanInput({ ...base, dueOn: "2026-09-30" }, "2026-10-02"), /กำหนดคืน/);
  assert.throws(() => loans.validateLoanInput({ ...base, loanedOn: "2026-10-05", dueOn: "2026-10-09" }, "2026-10-02"), /วันที่ยืม/);
  assert.throws(() => loans.validateLoanInput({ ...base, dueOn: "2027-12-01" }, "2026-10-02"), /1 ปี/);
  assert.equal(loans.validateReturn({ returnedOn: "2026-10-05", condition: "Damaged", loanedOn: "2026-10-01" }, "2026-10-05"), "Damaged");
  assert.throws(() => loans.validateReturn({ returnedOn: "2026-09-30", condition: "Good", loanedOn: "2026-10-01" }, "2026-10-05"), /ก่อนวันที่ยืม/);
});

const row = (id, extra) => ({ id, assetNumber: `สสจ.${id}`, assetName: `รายการ ${id}`, acquiredOn: "2019-01-15", requestType: "Disposed", disposalMethod: "Sale", reason: "ชำรุดเกินซ่อม", purchasePrice: 20000, bookValue: 1, requestedBy: "เจ้าหน้าที่", requestedAt: "2026-10-01 09:00:00", decidedAt: "2026-10-05 10:00:00", approvalDocumentNo: "สต 0033/1", executedOn: "", executionDocumentNo: "", proceedsAmount: null, ...extra });

test("disposal documents: pending list and annual report with totals", () => {
  const rows = [row(1), row(2, { requestType: "Lost", disposalMethod: null, purchasePrice: 5000, bookValue: 5000 }), row(3, { executedOn: "2026-11-01", executionDocumentNo: "ใบเสร็จ 12/345", proceedsAmount: 1500 })];
  const totals = report.summarizeDisposals(rows);
  assert.deepEqual(JSON.parse(JSON.stringify(totals)), { count: 3, disposed: 2, lost: 1, cost: 45000, bookValue: 5002, proceeds: 1500, awaitingExecution: 1 });

  const pending = XLSX.read(report.buildDisposalWorkbook(rows, { kind: "pending", facilityName: "สสจ.สตูล", printedBy: "ผู้ทดสอบ" }).buffer, { type: "buffer" });
  const pendingText = XLSX.utils.sheet_to_csv(pending.Sheets[pending.SheetNames[0]]);
  assert.match(pendingText, /รายการพัสดุที่ขออนุมัติจำหน่าย/);
  assert.match(pendingText, /สูญหาย \(จำหน่ายเป็นสูญ\)/);
  assert.match(pendingText, /หัวหน้าหน่วยงาน \(ผู้อนุมัติ\)/);

  const annual = XLSX.read(report.buildDisposalWorkbook(rows, { kind: "annual", facilityName: "สสจ.สตูล", fiscalYear: 2570, printedBy: "ผู้ทดสอบ" }).buffer, { type: "buffer" });
  const sheet = annual.Sheets[annual.SheetNames[0]];
  const text = XLSX.utils.sheet_to_csv(sheet);
  assert.match(text, /ประจำปีงบประมาณ 2570/);
  assert.match(text, /ยังไม่บันทึกผล/);
  assert.match(text, /ใบเสร็จ 12\/345/);
  const values = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const total = values.find((line) => line[0] === "รวม");
  assert.equal(total[3], 45000);
  assert.equal(total[8], 1500);
});
