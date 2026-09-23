import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
  fs.readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;
const key = "ab".repeat(32);
const identity = { thaiCid: "1234567890123", firstName: "สมชาย", lastName: "ใจดี" };
const hash = (cid) => crypto.createHmac("sha256", Buffer.from(key, "hex")).update(cid).digest("hex");
const account = (overrides = {}) => ({
  id: 1, first_name: "สมชาย", last_name: "ใจดี", thaid_cid: null,
  thaid_cid_hash: null, is_active: 1, role: "officer",
  // SEC-04: ผู้ดูแลระบบต้องเปิดสิทธิ์ผูก ThaiD ให้ก่อน
  thaid_link_enabled: 1, thaid_link_expected_hash: null, ...overrides,
});

function setup(initialRows, beforeUpdate, options = {}) {
  const rows = structuredClone(initialRows);
  const writes = [];
  let nameQueries = 0;
  const db = {
    async selectRows(sql, args) {
      if (options.legacySchema && sql.includes("thaid_link_enabled")) {
        const error = new Error("Unknown column 'thaid_link_enabled' in 'field list'");
        error.code = "ER_BAD_FIELD_ERROR";
        throw error;
      }
      if (sql.includes("WHERE thaid_cid_hash")) {
        return rows.filter((row) => row.thaid_cid_hash === args[0] || row.thaid_cid === args[1])
          .slice(0, 1).map((row) => ({ ...row }));
      }
      assert.ok(sql.includes("CAST(TRIM(first_name) AS BINARY)"));
      nameQueries++;
      return rows.filter((row) => row.first_name.trim() === args[0] && row.last_name.trim() === args[1])
        .slice(0, 2).map((row) => ({ ...row }));
    },
    async executeStatement(sql, args) {
      assert.ok(sql.includes("AND is_active = 1"));
      assert.ok(sql.includes("thaid_cid_hash IS NULL"));
      if (beforeUpdate) beforeUpdate(rows);
      const [cid, cidHash, id, firstName, lastName] = args;
      const row = rows.find((entry) => entry.id === id && entry.is_active === 1
        && !entry.thaid_cid && !entry.thaid_cid_hash
        && entry.first_name.trim() === firstName && entry.last_name.trim() === lastName);
      if (!row) return { affectedRows: 0 };
      writes.push(args);
      row.thaid_cid = cid;
      row.thaid_cid_hash = cidHash;
      return { affectedRows: 1 };
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, Buffer,
    process: { env: { THAID_CID_ENCRYPTION_KEY: key, AUTH_SECRET: "test-only" } },
    require(id) {
      if (id === "server-only") return {};
      if (id === "node:crypto") return { __esModule: true, default: crypto };
      if (id === "next/headers") return {};
      if (id === "@/lib/mysql") return db;
      if (id === "@/lib/cookie-security") return { secureCookiesEnabled: () => false };
      if (id === "@/lib/schema-errors") {
        return { isMissingSchemaError: (error) => error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR" };
      }
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return { auth: exports, rows, writes, get nameQueries() { return nameQueries; } };
}

test("first login links a unique account with encrypted CID; next login uses CID despite name change", async () => {
  const ctx = setup([account()]);
  const user = await ctx.auth.findOrLinkUserByVerifiedThaiD(identity);
  assert.equal(user.id, 1);
  assert.equal(user.thaid_cid, identity.thaiCid);
  assert.ok(ctx.rows[0].thaid_cid.startsWith("thcid:v1:"));
  assert.equal(ctx.rows[0].thaid_cid_hash, hash(identity.thaiCid));
  const returning = await ctx.auth.findOrLinkUserByVerifiedThaiD({ ...identity, firstName: "ชื่อใหม่", lastName: "" });
  assert.equal(returning.id, 1);
  assert.equal(ctx.nameQueries, 1);
  assert.equal(ctx.writes.length, 1);
});

test("no matching name leaves registration flow available", async () => {
  const ctx = setup([account({ last_name: "คนละคน" })]);
  assert.equal(await ctx.auth.findOrLinkUserByVerifiedThaiD(identity), null);
  assert.equal(ctx.writes.length, 0);
});

test("same first name or a changed Thai mark does not match", async () => {
  const ctx = setup([account({ last_name: "ใจดี๊" })]);
  assert.equal(await ctx.auth.findOrLinkUserByVerifiedThaiD(identity), null);
});

test("trims surrounding whitespace without stripping name content", async () => {
  const ctx = setup([account({ first_name: " สมชาย " })]);
  assert.equal((await ctx.auth.findOrLinkUserByVerifiedThaiD({ ...identity, lastName: " ใจดี " })).id, 1);
});

test("duplicate names are rejected even if one is inactive or already linked", async () => {
  for (const other of [account({ id: 2 }), account({ id: 2, is_active: 0 }), account({ id: 2, thaid_cid_hash: "another" })]) {
    const ctx = setup([account(), other]);
    await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD(identity), /ชื่อ–นามสกุลซ้ำ/);
    assert.equal(ctx.writes.length, 0);
  }
});

test("never replaces another ThaiD identity, including hash-only records", async () => {
  for (const linked of [{ thaid_cid: "9876543210123" }, { thaid_cid_hash: "another" }]) {
    const ctx = setup([account(linked)]);
    await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD(identity), /เชื่อมต่อ ThaiD ไว้แล้ว/);
    assert.equal(ctx.writes.length, 0);
  }
});

test("inactive account remains pending without being linked", async () => {
  const ctx = setup([account({ is_active: 0 })]);
  assert.equal((await ctx.auth.findOrLinkUserByVerifiedThaiD(identity)).is_active, 0);
  assert.equal(ctx.writes.length, 0);
});

test("missing verified name or invalid CID cannot link", async () => {
  for (const invalid of [{ firstName: "" }, { lastName: "" }, { thaiCid: "123" }]) {
    const ctx = setup([account()]);
    await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD({ ...identity, ...invalid }));
    assert.equal(ctx.writes.length, 0);
  }
});

test("concurrent identity, name or approval changes prevent linking", async () => {
  for (const change of [{ thaid_cid_hash: "other" }, { first_name: "เปลี่ยนชื่อ" }, { is_active: 0 }]) {
    const ctx = setup([account()], (rows) => Object.assign(rows[0], change));
    await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD(identity), /ข้อมูลบัญชีเปลี่ยน/);
    assert.equal(ctx.writes.length, 0);
  }
});

test("SEC-04: does not link an account the admin has not enabled", async () => {
  const ctx = setup([account({ thaid_link_enabled: 0 })]);
  await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD(identity), /ยังไม่ได้เปิดให้เชื่อมต่อ ThaiD/);
  assert.equal(ctx.writes.length, 0);
});

test("SEC-04: links when the admin pre-registered the CID hash, even without the flag", async () => {
  const ctx = setup([account({ thaid_link_enabled: 0, thaid_link_expected_hash: hash(identity.thaiCid) })]);
  assert.equal((await ctx.auth.findOrLinkUserByVerifiedThaiD(identity)).id, 1);
  assert.equal(ctx.writes.length, 1);
});

test("SEC-04: a pre-registered hash for a different CID does not link", async () => {
  const ctx = setup([account({ thaid_link_enabled: 0, thaid_link_expected_hash: hash("9876543210123") })]);
  await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD(identity), /ยังไม่ได้เปิดให้เชื่อมต่อ ThaiD/);
  assert.equal(ctx.writes.length, 0);
});

test("SEC-04: an admin account never links by name, with or without the migration", async () => {
  for (const options of [{}, { legacySchema: true }]) {
    const ctx = setup([account({ role: "admin" })], undefined, options);
    await assert.rejects(ctx.auth.findOrLinkUserByVerifiedThaiD(identity), /บัญชีผู้ดูแลระบบ/);
    assert.equal(ctx.writes.length, 0);
  }
});

test("SEC-04: before the migration, non-admin linking keeps working", async () => {
  const ctx = setup([account({ thaid_link_enabled: undefined })], undefined, { legacySchema: true });
  assert.equal((await ctx.auth.findOrLinkUserByVerifiedThaiD(identity)).id, 1);
  assert.equal(ctx.writes.length, 1);
});
