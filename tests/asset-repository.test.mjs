import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup(linked = []) {
  const writes = [], reads = [];
  const repository = loadTs("lib/assets.ts", {
    "@/app/atacs-data": { facilitySurveys: [] },
    "@/lib/mysql": {
      withTransaction: async work => work(),
      selectRows: async (sql, values) => { reads.push({ sql, values }); return sql.includes("EXISTS (SELECT 1 FROM agent_devices") ? linked : []; },
      executeStatement: async (sql, values) => { writes.push({ sql, values }); return { insertId: 1 }; },
    },
  });
  return { repository, writes, reads };
}

test("name-only repository update never writes dates, license or classification", async () => {
  const { repository, writes } = setup();
  await repository.updateAsset(1, { assetName: "Renamed" });
  assert.equal(writes[0].sql, "UPDATE information_assets SET asset_name = ? WHERE id = ?");
  assert.deepEqual(Array.from(writes[0].values), ["Renamed", 1]);
});

test("explicit null and empty dates clear only the fields requested", async () => {
  const { repository, writes } = setup();
  await repository.updateAsset(1, { purchaseDate: null, maintenanceEndDate: "" });
  assert.equal(writes[0].sql, "UPDATE information_assets SET purchase_date = ?, maintenance_end_date = ? WHERE id = ?");
  assert.deepEqual(Array.from(writes[0].values), [null, null, 1]);
});

test("linked Agent blocks incompatible classification and relocation, allows eligible IT edits", async () => {
  const { repository, writes } = setup([{ asset_class: "IT", asset_category: "Hardware", device_type: "Desktop", survey_id: 9 }]);
  for (const patch of [{ assetClass: "Vehicle" }, { assetCategory: "Software" }, { deviceType: "Printer" }, { surveyId: 10 }]) {
    await assert.rejects(repository.updateAsset(1, patch), /Agent/);
  }
  assert.equal(writes.length, 0);
  await repository.updateAsset(1, { assetClass: "IT", deviceType: "Notebook", surveyId: 9 });
  assert.equal(writes.length, 1);
});

test("unknown explicit class cannot be written and missing create class defaults to IT", async () => {
  const { repository, writes } = setup();
  await assert.rejects(repository.updateAsset(1, { assetClass: "Typo" }));
  await assert.rejects(repository.createAsset({ surveyId: 1, assetName: "Desk", assetCategory: "Hardware", assetClass: "Typo" }));
  assert.equal(writes.length, 0);
  await repository.createAsset({ surveyId: 1, assetName: "PC", assetRegistrationNo: null, assetCategory: "Hardware" });
  assert.ok(writes[0].values.includes("IT"));
});

test("Hardware/Software filters always constrain IT and SQL values remain parameterized", async () => {
  const { repository, reads } = setup();
  await repository.listAssets({ assetGroup: "Hardware", assetClass: "Office", search: "' OR 1=1", limit: 25, offset: 25 });
  assert.match(reads[0].sql, /TRIM\(a.asset_class\).*'IT'.*a.asset_category = \?/);
  assert.ok(!reads[0].sql.includes("' OR 1=1"));
  assert.ok(reads[0].values.includes("Office"));
  assert.deepEqual(Array.from(reads[0].values.slice(-2)), [25, 25]);
});

test("ช่องวันที่/ตัวเลขที่เว้นว่างตอนสร้างใหม่ ต้องบันทึกเป็น NULL ไม่ใช่ค่าว่าง", async () => {
  // ฟอร์มและไฟล์นำเข้าส่งค่าว่างมาเป็น "" ซึ่ง MySQL ปฏิเสธในคอลัมน์ DATE
  // (Incorrect date value: '' for column 'maintenance_start_date')
  const { repository, writes } = setup();
  await repository.createAsset({
    surveyId: 1,
    assetName: "เครื่องคอมพิวเตอร์",
    assetCategory: "Hardware",
    assetClass: "IT",
    maintenanceStartDate: "",
    maintenanceEndDate: "",
    purchaseDate: "",
    installedAt: "",
    purchasePrice: "",
    workGroupId: "",
    locationDetail: "",
  });
  const insert = writes.find((write) => write.sql.includes("INSERT INTO information_assets"));
  assert.ok(insert, "ต้องมีคำสั่ง INSERT");
  assert.ok(!Array.from(insert.values).includes(""), `พบค่าว่างในคำสั่ง INSERT: ${JSON.stringify(Array.from(insert.values))}`);
});

test("ค่าที่กรอกจริงตอนสร้างใหม่ยังถูกบันทึกตามเดิม", async () => {
  const { repository, writes } = setup();
  await repository.createAsset({
    surveyId: 1,
    assetName: "เครื่องคอมพิวเตอร์",
    assetCategory: "Hardware",
    assetClass: "IT",
    maintenanceStartDate: "2026-01-15",
    purchasePrice: 24000,
    currentStatus: "Broken",
  });
  const insert = writes.find((write) => write.sql.includes("INSERT INTO information_assets"));
  const values = Array.from(insert.values);
  assert.ok(values.includes("2026-01-15"));
  assert.ok(values.includes(24000));
  assert.ok(values.includes("Broken"));
});
