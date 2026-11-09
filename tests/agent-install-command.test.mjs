import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const mod = loadTs("lib/agent-install-command.ts", {}, { process: { env: {} } });
const SECRET = "test-auth-secret-0123456789abcdef";
const scope = { id: 41, facilityId: 7, workGroupId: 3 };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("derived install token is deterministic for the same row and scope", () => {
  const a = mod.deriveInstallToken(scope, SECRET);
  const b = mod.deriveInstallToken({ ...scope }, SECRET);
  assert.equal(a, b);
  assert.ok(a.startsWith("atacs_enroll_"));
  assert.match(a.slice("atacs_enroll_".length), /^[A-Za-z0-9_-]{43}$/);
});

test("derived install token matches the documented HMAC construction", () => {
  const expected = "atacs_enroll_" + crypto.createHmac("sha256", SECRET).update("agent-install:v1:41:7:3").digest("base64url");
  assert.equal(mod.deriveInstallToken(scope, SECRET), expected);
  const noGroup = "atacs_enroll_" + crypto.createHmac("sha256", SECRET).update("agent-install:v1:41:7:0").digest("base64url");
  assert.equal(mod.deriveInstallToken({ ...scope, workGroupId: null }, SECRET), noGroup);
});

test("derived install token differs across row ids, scopes and secrets", () => {
  const base = mod.deriveInstallToken(scope, SECRET);
  const variants = [
    mod.deriveInstallToken({ ...scope, id: 42 }, SECRET),
    mod.deriveInstallToken({ ...scope, facilityId: 8 }, SECRET),
    mod.deriveInstallToken({ ...scope, workGroupId: 4 }, SECRET),
    mod.deriveInstallToken({ ...scope, workGroupId: null }, SECRET),
    mod.deriveInstallToken(scope, `${SECRET}-rotated`),
  ];
  assert.equal(new Set([base, ...variants]).size, variants.length + 1);
});

test("missing AUTH_SECRET is refused instead of deriving a guessable token", () => {
  assert.throws(() => mod.deriveInstallToken(scope, ""), /AUTH_SECRET/);
  assert.throws(() => mod.deriveInstallToken(scope, undefined), /AUTH_SECRET/);
  assert.throws(() => mod.installTokenSecret({}), /AUTH_SECRET/);
  assert.throws(() => mod.installTokenSecret({ AUTH_SECRET: "   " }), /AUTH_SECRET/);
  assert.equal(mod.installTokenSecret({ AUTH_SECRET: ` ${SECRET} ` }), SECRET);
});

test("stored hash verification detects a rotated AUTH_SECRET", () => {
  const token = mod.deriveInstallToken(scope, SECRET);
  assert.equal(mod.installTokenMatches(scope, sha256(token), SECRET), true);
  assert.equal(mod.installTokenMatches(scope, sha256(token), `${SECRET}-new`), false);
  assert.equal(mod.installTokenMatches(scope, "not-a-hash", SECRET), false);
});

test("install scope enrollment names are recognisable and invalid ids are rejected", () => {
  assert.equal(mod.installScopeEnrollmentName("รพ.สต.บ้านนา"), "คำสั่งติดตั้ง · รพ.สต.บ้านนา");
  assert.equal(mod.installScopeEnrollmentName("รพ.สตูล", "กลุ่มงานไอที"), "คำสั่งติดตั้ง · รพ.สตูล · กลุ่มงานไอที");
  assert.equal(mod.isInstallScopeEnrollmentName("คำสั่งติดตั้ง · รพ.สตูล"), true);
  assert.equal(mod.isInstallScopeEnrollmentName("Install Key · รพ.สตูล"), false);
  assert.equal(mod.isInstallScopeEnrollmentName(null), false);
  assert.throws(() => mod.deriveInstallToken({ ...scope, id: 0 }, SECRET));
  assert.throws(() => mod.deriveInstallToken({ ...scope, facilityId: -1 }, SECRET));
});

test("install command embeds the token for the chosen OS", () => {
  const token = mod.deriveInstallToken(scope, SECRET);
  const windows = mod.buildAgentInstallCommand("windows", token);
  const linux = mod.buildAgentInstallCommand("linux", token);
  assert.match(windows, /-EnrollmentToken \$token/);
  assert.ok(windows.includes(`$token='${token}'`));
  assert.match(linux, /--enrollment-token "\$token"/);
  assert.ok(linux.includes(`token='${token}'`));
  assert.equal(mod.parseInstallOs("linux"), "linux");
  assert.equal(mod.parseInstallOs("windows"), "windows");
  assert.equal(mod.parseInstallOs("mac"), null);
});

/** lib/agent.ts with an in-memory agent_enrollments table */
function enrollmentHarness(rows = []) {
  const table = rows.map((row) => ({ is_active: 1, expires_at: null, ...row }));
  const writes = [];
  let nextId = Math.max(100, ...table.map((row) => row.id)) + 1;
  const agent = loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": {},
    "@/lib/mysql": {
      selectRows: async (sql, values) => {
        if (sql.includes("FROM agent_enrollments") && sql.includes("enrollment_name LIKE")) {
          const [facilityId, workGroupId] = values;
          return table.filter((row) => row.facility_id === facilityId && (row.work_group_id ?? null) === (workGroupId ?? null)
            && row.is_active === 1 && row.expires_at === null && row.enrollment_name.startsWith("คำสั่งติดตั้ง ·"));
        }
        return [];
      },
      executeStatement: async (sql, values) => {
        writes.push({ sql, values });
        if (sql.startsWith("INSERT INTO agent_enrollments")) {
          const [facility_id, work_group_id, enrollment_name, token_hash, created_by_user_id] = values;
          const row = { id: nextId++, facility_id, work_group_id, enrollment_name, token_hash, created_by_user_id, is_active: 1, expires_at: null };
          table.push(row);
          return { insertId: row.id, affectedRows: 1 };
        }
        if (sql.includes("SET token_hash = ?")) {
          const row = table.find((item) => item.id === values[1]);
          row.token_hash = values[0];
          return { affectedRows: 1 };
        }
        if (sql.includes("SET is_active = 0 WHERE id = ?")) {
          const row = table.find((item) => item.id === values[0]);
          if (row) row.is_active = 0;
          return { affectedRows: row ? 1 : 0 };
        }
        if (sql.includes("SET is_active = 0") && sql.includes("enrollment_name LIKE")) {
          const [facilityId, workGroupId] = values;
          let affectedRows = 0;
          for (const row of table) {
            if (row.facility_id === facilityId && (row.work_group_id ?? null) === (workGroupId ?? null) && row.is_active === 1
              && row.enrollment_name.startsWith("คำสั่งติดตั้ง ·")) { row.is_active = 0; affectedRows += 1; }
          }
          return { affectedRows };
        }
        return { affectedRows: 0 };
      },
    },
  }, { process: { env: { AUTH_SECRET: SECRET } } });
  return { agent, table, writes };
}

const input = { facilityId: 7, workGroupId: 3, enrollmentName: "คำสั่งติดตั้ง · รพ.สตูล · กลุ่มงานไอที", createdByUserId: 5 };

test("first copy creates one reusable row whose stored hash is the derived token's hash, never the plaintext", async () => {
  const ctx = enrollmentHarness();
  const first = await ctx.agent.getOrCreateInstallScopeToken(input);
  assert.equal(first.created, true);
  assert.equal(ctx.table.length, 1);
  const row = ctx.table[0];
  assert.equal(first.enrollmentId, row.id);
  assert.equal(first.token, mod.deriveInstallToken({ id: row.id, facilityId: 7, workGroupId: 3 }, SECRET));
  assert.equal(row.token_hash, sha256(first.token));
  assert.ok(!JSON.stringify(ctx.writes).includes(first.token), "plaintext token must never be written to the DB");

  const second = await ctx.agent.getOrCreateInstallScopeToken(input);
  assert.equal(second.created, false);
  assert.equal(second.token, first.token);
  assert.equal(ctx.table.length, 1);
});

test("a row whose hash no longer verifies (AUTH_SECRET rotated) is deactivated and replaced", async () => {
  const ctx = enrollmentHarness([{ id: 9, facility_id: 7, work_group_id: 3, enrollment_name: input.enrollmentName, token_hash: sha256("old-secret-token") }]);
  const result = await ctx.agent.getOrCreateInstallScopeToken(input);
  assert.equal(result.created, true);
  assert.equal(result.rotated, 1);
  assert.equal(ctx.table.find((row) => row.id === 9).is_active, 0);
  assert.equal(ctx.table.filter((row) => row.is_active === 1).length, 1);
});

test("revoking a scope deactivates its rows and the next copy yields a different token", async () => {
  const ctx = enrollmentHarness();
  const first = await ctx.agent.getOrCreateInstallScopeToken(input);
  const revoked = await ctx.agent.revokeInstallScopeEnrollments({ facilityId: 7, workGroupId: 3 });
  assert.equal(revoked, 1);
  const next = await ctx.agent.getOrCreateInstallScopeToken(input);
  assert.notEqual(next.token, first.token);
  assert.equal(next.created, true);
});

test("work-group-less scopes are kept separate from work-group scopes", async () => {
  const ctx = enrollmentHarness();
  const grouped = await ctx.agent.getOrCreateInstallScopeToken(input);
  const plain = await ctx.agent.getOrCreateInstallScopeToken({ ...input, workGroupId: null, enrollmentName: "คำสั่งติดตั้ง · รพ.สตูล" });
  assert.notEqual(grouped.token, plain.token);
  assert.equal(ctx.table.length, 2);
});

test("missing AUTH_SECRET fails before any DB write", async () => {
  const writes = [];
  const agent = loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": {},
    "@/lib/mysql": { selectRows: async () => [], executeStatement: async (sql) => { writes.push(sql); return { insertId: 1 }; } },
  }, { process: { env: {} } });
  await assert.rejects(() => agent.getOrCreateInstallScopeToken(input), /AUTH_SECRET/);
  assert.equal(writes.length, 0);
});

test("agent settings and download UI no longer reveal or create raw tokens", () => {
  const files = [
    "app/(main)/admin/settings/agent/page.tsx",
    "app/(main)/admin/settings/agent/_components/install-command-panel.tsx",
    "app/(main)/agent-download/page.tsx",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /createdToken|createAgentEnrollmentAction|createOfficerDownloadTokenAction|staticInstallKey|getPrimaryAgentInstallKey/, file);
  }
  const actions = read("app/(main)/admin/settings/agent/actions.ts");
  assert.match(actions, /export async function getInstallCommand/);
  assert.match(actions, /export async function revokeInstallCommand/);
});
