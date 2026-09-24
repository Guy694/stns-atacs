import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const requirements = JSON.parse(
  fs.readFileSync(new URL("../database/schema-requirements.json", import.meta.url), "utf8")
);
const { pendingMigrations, MIGRATION_REQUIREMENTS } = loadTs("lib/schema-check.ts", {
  "@/lib/mysql": { selectRows: async () => [] },
  "@/database/schema-requirements.json": { __esModule: true, default: requirements },
});

const present = (tables, columns = {}) => ({
  tables: new Set(tables),
  columns: new Map(Object.entries(columns).map(([table, cols]) => [table, new Set(cols)])),
});

test("the requirement list is loaded from database/schema-requirements.json", () => {
  assert.ok(MIGRATION_REQUIREMENTS.length >= 10);
  assert.ok(MIGRATION_REQUIREMENTS.every((item) => typeof item.file === "string"));
});

test("reports a migration whose table is missing", () => {
  const list = [{ file: "a.sql", tables: ["asset_loans"], columns: {} }];
  assert.equal(pendingMigrations(present([]), list).length, 1);
  assert.equal(pendingMigrations(present(["asset_loans"]), list).length, 0);
});

test("reports a migration whose column is missing, naming table.column", () => {
  const list = [{ file: "b.sql", tables: [], columns: { users: ["thaid_link_enabled", "role"] } }];
  const [pending] = pendingMigrations(present(["users"], { users: ["role"] }), list);
  assert.equal(pending.file, "b.sql");
  assert.equal(pending.missing.length, 1);
  assert.equal(pending.missing[0], "users.thaid_link_enabled");
});

test("a fully migrated database reports nothing pending", () => {
  const list = [{ file: "c.sql", tables: ["t"], columns: { t: ["a", "b"] } }];
  assert.equal(pendingMigrations(present(["t"], { t: ["a", "b"] }), list).length, 0);
});
