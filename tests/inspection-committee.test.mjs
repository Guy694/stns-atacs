import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { normalizeCommittee } = loadTs("lib/inspection.ts", { "@/lib/mysql": { selectRows: async () => [], executeStatement: async () => ({}), withTransaction: async (work) => work() } });
const plain = value => JSON.parse(JSON.stringify(value));

test("committee roles come from the dropdown; the chair is stored first", () => {
  const members = normalizeCommittee([
    { role: "member", fullName: "ก", position: "p1" },
    { role: "chair", fullName: "ข", position: "p2" },
    { role: "member", fullName: "", position: "" },
    { role: "member", fullName: "ค", position: "" },
  ]);
  assert.deepEqual(plain(members), [
    { role: "chair", fullName: "ข", position: "p2", seq: 1 },
    { role: "member", fullName: "ก", position: "p1", seq: 2 },
    { role: "member", fullName: "ค", position: "", seq: 3 },
  ]);
  assert.deepEqual(plain(normalizeCommittee([{ role: "chair", fullName: "", position: "" }])), [], "an empty committee is allowed");
});

test("exactly one chair, and no position without a name", () => {
  assert.throws(() => normalizeCommittee([{ role: "member", fullName: "ก" }]), /เลือกประธานกรรมการ 1 คน/);
  assert.throws(() => normalizeCommittee([{ role: "chair", fullName: "ก" }, { role: "chair", fullName: "ข" }]), /ได้เพียง 1 คน/);
  assert.throws(() => normalizeCommittee([{ role: "chair", fullName: "ก" }, { role: "member", fullName: "", position: "x" }]), /ระบุชื่อกรรมการ/);
  assert.equal(normalizeCommittee([{ role: "hacker", fullName: "ก" }, { role: "chair", fullName: "ข" }])[1].role, "member", "unknown roles become member");
});
