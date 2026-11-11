import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { classifyAgentAuthFailure, describeReportingMachine, summarizeUnknownAgents } = loadTs("lib/agent-auth-failure.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a known agent with the wrong key is a security problem; an unknown or retired one is housekeeping", () => {
  assert.deepEqual(plain(classifyAgentAuthFailure(null)), { kind: "unknown", eventType: "agent_unknown_id", alertSecurity: false, code: "AGENT_UNKNOWN" });
  assert.deepEqual(plain(classifyAgentAuthFailure({ isActive: false })), { kind: "retired", eventType: "agent_retired_report", alertSecurity: false, code: "AGENT_RETIRED" });
  assert.deepEqual(plain(classifyAgentAuthFailure({ isActive: true })), { kind: "wrong-key", eventType: "agent_invalid_credentials", alertSecurity: true, code: "AGENT_INVALID" });
});

test("identifies the reporting machine from its payload, without trusting the input", () => {
  assert.equal(
    describeReportingMachine({ hostname: "DESKTOP-J7K8VSS", currentUser: "STN\\nurse01", serialNumber: "NXVLFST01Z", operatingSystem: "Microsoft Windows 11 Pro", agentVersion: "1.0.0" }),
    "เครื่อง DESKTOP-J7K8VSS · ผู้ใช้ STN\\nurse01 · SN NXVLFST01Z · Microsoft Windows 11 Pro · Agent 1.0.0"
  );
  assert.equal(describeReportingMachine({ hostname: "<script>x</script>".padEnd(300, "a") }).length <= 400, true);
  assert.doesNotMatch(describeReportingMachine({ hostname: "<b>pc</b>" }), /[<>]/);
  assert.equal(describeReportingMachine(null), "ไม่ทราบข้อมูลเครื่อง");
  assert.equal(describeReportingMachine({ hostname: 42 }), "ไม่ทราบข้อมูลเครื่อง");
});

test("groups unknown-agent events per agent id, newest machine description wins", () => {
  const rows = [
    { identity: "a-1", ip: "10.0.0.5", detail: "เครื่อง PC-OLD", createdAt: "2026-09-01 08:00:00" },
    { identity: "a-1", ip: "203.150.12.9", detail: "เครื่อง PC-NEW", createdAt: "2026-09-23 23:33:07" },
    { identity: "b-2", ip: "10.0.0.9", detail: null, createdAt: "2026-09-10 10:00:00" },
  ];
  assert.deepEqual(plain(summarizeUnknownAgents(rows)), [
    { agentId: "a-1", reports: 2, ips: ["203.150.12.9", "10.0.0.5"], machine: "เครื่อง PC-NEW", firstSeen: "2026-09-01 08:00:00", lastSeen: "2026-09-23 23:33:07" },
    { agentId: "b-2", reports: 1, ips: ["10.0.0.9"], machine: null, firstSeen: "2026-09-10 10:00:00", lastSeen: "2026-09-10 10:00:00" },
  ]);
});
