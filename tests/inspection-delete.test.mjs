import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function load(roundRows = 1) {
  const statements = [];
  const inspection = loadTs("lib/inspection.ts", {
    "@/lib/mysql": {
      withTransaction: async (work) => work(),
      selectRows: async () => [],
      executeStatement: async (sql, values) => {
        statements.push({ sql, values: JSON.parse(JSON.stringify(values)) });
        return { affectedRows: sql.includes("asset_inspection_items") ? 7 : roundRows };
      },
    },
  });
  return { inspection, statements };
}

test("deleting a round removes its items and the round only, never asset records", async () => {
  const { inspection, statements } = load();
  assert.equal((await inspection.deleteInspection(12)).deletedItems, 7);
  assert.deepEqual(statements.map(s => s.sql), [
    "DELETE FROM asset_inspection_items WHERE inspection_id = ?",
    "DELETE FROM asset_inspections WHERE id = ?",
  ]);
  assert.ok(statements.every(s => s.values[0] === 12));
  assert.ok(statements.every(s => !/information_assets|asset_status_history/.test(s.sql)));
});

test("a missing round fails so the transaction rolls back", async () => {
  const { inspection } = load(0);
  await assert.rejects(inspection.deleteInspection(99), /ไม่พบรอบตรวจนับ/);
});
