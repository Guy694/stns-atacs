import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup(openCounts) {
  const writes = [];
  const lib = loadTs("lib/asset-transfers.ts", {
    "@/lib/mysql": {
      withTransaction: async (work) => work(),
      selectRows: async (sql) => {
        if (/WHERE a\.id = \?.* FOR UPDATE/.test(sql)) return [{ id: 9, asset_name: "PC", survey_id: 1, facility_id: 1, facility_name: "A", work_group_id: null, current_status: "Active" }];
        if (sql.includes("FROM information_asset_surveys s LEFT JOIN")) return [{ facility_id: 2, facility_name: "B" }];
        if (sql.includes("FROM facility_work_groups")) return [];
        if (sql.includes("AS open_repairs")) return [openCounts];
        return [];
      },
      executeStatement: async (sql, values) => { writes.push({ sql, values }); return { insertId: 1, affectedRows: 1 }; },
    },
    "@/lib/assets": { updateAsset: async () => {} },
    "@/lib/asset-status-history": { ensureAssetStatusHistoryTable: async () => {}, insertAssetStatusHistory: async () => {} },
  });
  return { lib, writes };
}

const input = { assetId: 9, toSurveyId: 2, transferDate: "2026-01-05", reason: "ย้าย", userId: 1, userName: "Admin" };

test("an asset with open repairs, loans or disposal requests cannot move to another facility", async () => {
  const { lib, writes } = setup({ open_repairs: 1, open_loans: 1, pending_disposals: 0 });
  await assert.rejects(lib.transferAsset(input), /งานซ่อมที่ยังไม่ปิด 1 รายการ.*กำลังถูกยืม 1 รายการ/);
  assert.equal(writes.length, 0);
});

test("an asset without open work transfers as before", async () => {
  const { lib, writes } = setup({ open_repairs: 0, open_loans: 0, pending_disposals: 0 });
  await lib.transferAsset(input);
  assert.ok(writes.some((w) => /INSERT INTO asset_transfers/.test(w.sql)));
});
