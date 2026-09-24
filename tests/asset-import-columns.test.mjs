import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { IMPORT_COLUMNS, IMPORT_HEADERS, REQUIREMENT_LABELS, importSampleRow } = loadTs("lib/asset-import-columns.ts");

test("ทุกคอลัมน์มีคำอธิบายครบ ไม่มีชื่อซ้ำ", () => {
  assert.ok(IMPORT_COLUMNS.length >= 50);
  assert.equal(new Set(IMPORT_HEADERS).size, IMPORT_HEADERS.length, "มีชื่อคอลัมน์ซ้ำ");
  for (const column of IMPORT_COLUMNS) {
    assert.ok(column.label, `${column.column} ไม่มีความหมาย`);
    assert.ok(column.format, `${column.column} ไม่มีรูปแบบ`);
    assert.ok(REQUIREMENT_LABELS[column.requirement], `${column.column} มีระดับความจำเป็นที่ไม่รู้จัก`);
  }
});

test("ลำดับคอลัมน์ยังตรงกับไฟล์เดิม และคอลัมน์ใหม่ต่อท้าย", () => {
  // ไฟล์ที่ผู้ใช้เก็บไว้ต้องยังใช้ได้ ตำแหน่ง 28 ตัวแรกจึงห้ามสลับ
  assert.equal(IMPORT_HEADERS[0], "id");
  assert.equal(IMPORT_HEADERS[1], "work_group_id");
  assert.equal(IMPORT_HEADERS[3], "asset_name");
  assert.equal(IMPORT_HEADERS[27], "subtype_id");
  assert.equal(IMPORT_HEADERS.at(-1), "work_group_name", "คอลัมน์ใหม่ต้องต่อท้ายเสมอ");
  assert.equal(IMPORT_HEADERS.at(-2), "unit_name");
});

test("asset_name เป็นช่องเดียวที่จำเป็นเสมอ", () => {
  const required = IMPORT_COLUMNS.filter((column) => column.requirement === "required").map((column) => column.column);
  assert.deepEqual([...required], ["asset_name"]);
});

test("คอลัมน์ที่มีชุดค่าตายตัวต้องบอกค่าที่อนุญาต", () => {
  for (const name of ["asset_class", "asset_category", "current_status", "funding_source", "acquisition_method", "windows_license_status"]) {
    const column = IMPORT_COLUMNS.find((item) => item.column === name);
    assert.ok(column, `ไม่มีคอลัมน์ ${name}`);
    assert.ok(column.allowed && column.allowed.length > 0, `${name} ต้องระบุค่าที่อนุญาต`);
  }
  assert.match(IMPORT_COLUMNS.find((item) => item.column === "current_status").allowed, /Active/);
  assert.match(IMPORT_COLUMNS.find((item) => item.column === "asset_class").allowed, /IT/);
});

test("แถวตัวอย่างมีจำนวนช่องเท่าหัวคอลัมน์", () => {
  const row = importSampleRow(Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.column, column.example])));
  assert.equal(row.length, IMPORT_HEADERS.length);
  assert.equal(row[IMPORT_HEADERS.indexOf("asset_name")], "เครื่องคอมพิวเตอร์แบบที่ 1");
  assert.equal(row[IMPORT_HEADERS.indexOf("id")], "", "คอลัมน์ id ในแถวตัวอย่างต้องว่าง (= เพิ่มรายการใหม่)");
});

test("คอลัมน์วันที่ทั้งหมดบอกรูปแบบ YYYY-MM-DD", () => {
  for (const name of ["purchase_date", "maintenance_start_date", "maintenance_end_date", "installed_at", "warranty_end_date", "calibration_date"]) {
    const column = IMPORT_COLUMNS.find((item) => item.column === name);
    assert.match(column.format, /YYYY-MM-DD/, `${name} ต้องบอกรูปแบบวันที่`);
  }
});
