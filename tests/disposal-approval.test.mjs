import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup() {
  const writes = [];
  const lib = loadTs("lib/asset-disposals.ts", {
    "@/lib/mysql": {
      withTransaction: async (work) => work(),
      selectRows: async (sql) => {
        if (sql.includes("FROM asset_disposal_requests WHERE id = ? FOR UPDATE")) return [{ id: 5, asset_id: 9, facility_id: 1, request_type: "Disposed", status: "Pending", requested_by_user_id: 2 }];
        if (sql.includes("FROM information_assets WHERE id = ? FOR UPDATE")) return [{ current_status: "Broken" }];
        return [];
      },
      executeStatement: async (sql, values) => { writes.push({ sql, values }); return { affectedRows: 1 }; },
    },
    "@/lib/assets": { updateAsset: async () => {} },
    "@/lib/asset-status-history": { ensureAssetStatusHistoryTable: async () => {}, insertAssetStatusHistory: async () => {} },
  });
  return { lib, writes };
}

test("approving a disposal closes the asset's open loans and stamps cancelled repairs", async () => {
  const { lib, writes } = setup();
  await lib.decideDisposalRequest({ requestId: 5, decision: "Approved", userId: 1, userName: "Admin" });
  const loan = writes.find((w) => /UPDATE asset_loans SET status = 'Cancelled'/.test(w.sql));
  assert.ok(loan, "open loans must be closed");
  assert.match(loan.sql, /WHERE asset_id = \? AND status = 'OnLoan'/);
  const repair = writes.find((w) => /UPDATE asset_repairs SET status = 'Cancelled'/.test(w.sql));
  assert.match(repair.sql, /completed_at = NOW\(\)/);
});
