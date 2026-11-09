import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { userFacingError, friendlyLifecycleError } = loadTs("lib/schema-errors.ts");
const dbError = (code, sqlMessage) => Object.assign(new Error(sqlMessage), { code, errno: 1000, sqlMessage, sql: "INSERT INTO information_assets ..." });
const quiet = (fn) => { const original = console.error; console.error = () => {}; try { return fn(); } finally { console.error = original; } };

test("X2: business errors thrown on purpose keep their Thai message", () => {
  assert.equal(userFacingError(new Error("ทรัพย์สินนี้ถูกลบแล้ว แก้ไขไม่ได้")), "ทรัพย์สินนี้ถูกลบแล้ว แก้ไขไม่ได้");
});

test("X2: raw MySQL errors never reach the user (no table/column names)", () => {
  const cases = [
    ["ER_DUP_ENTRY", "Duplicate entry 'X' for key 'uk_assets_reg'"],
    ["ER_DATA_TOO_LONG", "Data too long for column 'asset_name' at row 1"],
    ["ER_TRUNCATED_WRONG_VALUE", "Incorrect date value: '2026-13-01' for column 'purchase_date'"],
    ["ER_LOCK_WAIT_TIMEOUT", "Lock wait timeout exceeded; try restarting transaction"],
    ["ER_SOMETHING_NEW", "Unknown thing in table information_assets"],
  ];
  for (const [code, message] of cases) {
    const shown = quiet(() => userFacingError(dbError(code, message), "บันทึกไม่สำเร็จ"));
    assert.ok(!/information_assets|asset_name|purchase_date|uk_assets|Duplicate|Lock wait|Incorrect/.test(shown), `${code} leaked: ${shown}`);
    assert.ok(shown.length > 0);
  }
  assert.match(quiet(() => userFacingError(dbError("ER_DUP_ENTRY", "Duplicate entry"))), /ซ้ำ/);
  assert.match(quiet(() => userFacingError(dbError("ER_DATA_TOO_LONG", "Data too long for column 'x'"))), /ยาวเกิน/);
});

test("X2: connection failures get a retry message; non-Error values get the fallback", () => {
  assert.match(quiet(() => userFacingError(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), { code: "ECONNREFUSED" }))), /ฐานข้อมูล/);
  assert.equal(userFacingError("boom", "ลองใหม่"), "ลองใหม่");
});

test("X2: friendlyLifecycleError keeps the migration hint and hides other DB errors", () => {
  assert.match(friendlyLifecycleError(dbError("ER_NO_SUCH_TABLE", "Table 'stn_atacs.asset_loans' doesn't exist")), /add_asset_lifecycle\.sql/);
  assert.ok(!/asset_name/.test(quiet(() => friendlyLifecycleError(dbError("ER_DATA_TOO_LONG", "Data too long for column 'asset_name'")))));
});
