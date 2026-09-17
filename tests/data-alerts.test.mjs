import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(fs.readFileSync(new URL("../lib/audit.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function setup({ total = 0, env = {}, failCount = false } = {}) {
  const alerts = [], writes = [], queries = [];
  const exports = {};
  const dependencies = {
    "server-only": {},
    "@/lib/mysql": {
      executeStatement: async (...args) => { writes.push(args); },
      selectRows: async (...args) => {
        queries.push(args);
        if (failCount) throw new Error("Database unavailable");
        return [{ total }];
      },
    },
    "@/lib/telegram": { notifyTelegramSafe: async (input) => { alerts.push(input); } },
  };
  vm.runInNewContext(source, { exports, process: { env }, console: { error() {} },
    require: (id) => dependencies[id] });
  return { write: exports.writeAuditLog, alerts, writes, queries };
}

const input = { userId: 1, userName: "Officer", action: "create", entity: "information_assets" };

test("ordinary saves retain audit logs without Telegram alerts", async () => {
  const ctx = setup({ total: 49 });
  for (const action of ["create", "update", "delete", "transfer", "dispose", "inspect"]) {
    await ctx.write({ ...input, action });
  }
  assert.equal(ctx.writes.length, 6);
  assert.equal(ctx.queries.length, 1);
  assert.equal(ctx.alerts.length, 0);
});

test("threshold crossing sends a burst alert with a stable deduplication key", async () => {
  const ctx = setup({ total: 50 });
  await ctx.write(input);
  assert.equal(ctx.alerts.length, 1);
  assert.match(ctx.alerts[0].eventKey, /^data-burst:information_assets:1:\d+$/);
  assert.equal(ctx.alerts[0].details.จำนวนข้อมูล, "50 record ภายใน 10 นาที");
  assert.deepEqual(Array.from(ctx.queries[0][1]), ["information_assets", 1, 10]);
});

test("import rows retain audit logs and suppress burst checks", async () => {
  const ctx = setup({ total: 500 });
  await ctx.write({ ...input, skipDataAlert: true });
  assert.equal(ctx.writes.length, 1);
  assert.equal(ctx.queries.length, 0);
  assert.equal(ctx.alerts.length, 0);
});

test("custom thresholds work and invalid settings fall back to defaults", async () => {
  const custom = setup({ total: 3, env: { TELEGRAM_DATA_ALERT_THRESHOLD: "3", TELEGRAM_DATA_ALERT_WINDOW_MINUTES: "2" } });
  await custom.write(input);
  assert.equal(custom.alerts[0].details.จำนวนข้อมูล, "3 record ภายใน 2 นาที");
  const invalid = setup({ total: 49, env: { TELEGRAM_DATA_ALERT_THRESHOLD: "NaN", TELEGRAM_DATA_ALERT_WINDOW_MINUTES: "-1" } });
  await invalid.write(input);
  assert.equal(invalid.alerts.length, 0);
  assert.equal(invalid.queries[0][1][2], 10);
});

test("failed anomaly checks do not fail a saved audit log", async () => {
  const ctx = setup({ failCount: true });
  await assert.doesNotReject(ctx.write(input));
  assert.equal(ctx.writes.length, 1);
});
