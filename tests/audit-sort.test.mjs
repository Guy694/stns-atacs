import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function setup() {
  const reads = [];
  const audit = loadTs("lib/audit.ts", {
    "@/lib/mysql": { selectRows: async (sql, values) => { reads.push({ sql, values }); return sql.includes("COUNT(*)") ? [{ total: 60 }] : []; }, executeStatement: async () => ({}) },
    "@/lib/telegram": { notifyTelegramSafe: async () => {} },
  });
  return { audit, reads };
}

test("audit log list sorts by a whitelisted column with id as the tie-break", async () => {
  const { audit, reads } = setup();
  await audit.paginateAuditLogs({ orderBy: { key: "user", dir: "asc" } }, 2);
  assert.match(reads[1].sql, /ORDER BY user_name ASC, id ASC\s+LIMIT \? OFFSET \?/);
  assert.deepEqual(Array.from(reads[1].values), [25, 25]);
});

test("audit log list ignores unknown sort columns and keeps newest first", async () => {
  const { audit, reads } = setup();
  await audit.listAuditLogs({ orderBy: { key: "id; DROP TABLE users", dir: "asc" } });
  assert.match(reads[0].sql, /ORDER BY created_at DESC, id DESC/);
});
