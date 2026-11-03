import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const payload = loadTs("lib/agent-payload.ts");
const health = loadTs("lib/agent-health.ts");
const NOW = new Date("2026-10-13T08:00:00Z");

test("ตัดค่าขยะจาก BIOS และตรวจรูปแบบ IP / MAC", () => {
  for (const junk of ["To be filled by O.E.M.", "Default string", "System Serial Number", "0", "00000000", "FFFFFFFFFFFF", "N/A", " "]) {
    assert.equal(payload.cleanSerial(junk), null, junk);
  }
  assert.equal(payload.cleanSerial(" PF2ABC12 "), "PF2ABC12");
  assert.equal(payload.cleanIpv4("192.168.1.20"), "192.168.1.20");
  assert.equal(payload.cleanIpv4("169.254.3.4"), null);
  assert.equal(payload.cleanIpv4("999.1.1.1"), null);
  assert.equal(payload.cleanMac("aa-bb-cc-dd-ee-0f"), "AA:BB:CC:DD:EE:0F");
  assert.equal(payload.cleanMac("00:00:00:00:00:00"), null);
});

test("รายงานจาก Agent: ตัดความยาว แปลงชนิด และตัดค่าที่เป็นไปไม่ได้", () => {
  const clean = payload.cleanAgentReport({
    fingerprint: "ABCDEF0123456789",
    hostname: "PC-01\u0000" + "x".repeat(400),
    serialNumber: "To be filled by O.E.M.",
    biosSerial: "SN-REAL-1",
    ramMb: "8192",
    diskTotalGb: 500,
    diskFreeGb: 900,
    privateIp: "not-an-ip",
    status: "hacked",
    raw: "x".repeat(10_000),
    health: { volumes: [{ mount: "C:", totalGb: 100, freeGb: 3, isSystem: true }, { mount: "D:", totalGb: 10, freeGb: 50 }], cpuLoadPercent: 900 },
  }, NOW);
  assert.equal(clean.fingerprint, "abcdef0123456789");
  assert.equal(clean.hostname.length, 255);
  assert.ok(!clean.hostname.includes("\u0000"));
  assert.equal(clean.serialNumber, "SN-REAL-1");
  assert.equal(clean.ramMb, 8192);
  assert.equal(clean.diskFreeGb, null);
  assert.equal(clean.privateIp, null);
  assert.equal(clean.status, "online");
  assert.equal(clean.health.volumes.length, 1);
  assert.equal(clean.health.cpuLoadPercent, null);
  assert.equal("raw" in clean, false);
  assert.equal(payload.cleanAgentReport({ fingerprint: "../etc" }), null);
  assert.equal(payload.cleanAgentReport({ fingerprint: "a".repeat(65) }), null);
});

test("ไดรฟ์ระบบใกล้เต็มเป็นวิกฤต และเรียงปัญหาหนักก่อน", () => {
  const issues = health.evaluateAgentHealth({
    lastSeenAt: "2026-10-13 06:00:00",
    operatingSystem: "Windows 11 Pro",
    ramMb: 8192,
    agentVersion: "2.0.0",
    serialNumber: "SN1",
    diskTotalGb: 238,
    diskFreeGb: 3,
    healthJson: JSON.stringify({ volumes: [{ mount: "C:", totalGb: 237.9, freeGb: 3.2, isSystem: true }], antivirus: [{ name: "Defender", enabled: true, upToDate: true }], windowsActivation: "Licensed" }),
  }, NOW);
  assert.equal(issues[0].code, "system-disk-low");
  assert.equal(issues[0].severity, "critical");
  assert.equal(issues.length, 1);
});

test("Agent รุ่นเก่าใช้ยอดดิสก์รวม และแจ้ง Windows 10 หมดการสนับสนุน", () => {
  const issues = health.evaluateAgentHealth({
    lastSeenAt: "2026-10-01 06:00:00", operatingSystem: "Microsoft Windows 10 Pro", ramMb: 3800,
    agentVersion: "1.1.0", serialNumber: null, diskTotalGb: 500, diskFreeGb: 100, healthJson: null,
  }, NOW);
  const codes = issues.map((issue) => issue.code).sort().join();
  assert.equal(codes, ["agent-outdated", "memory-low", "no-serial", "offline", "os-eol"].sort().join());
  assert.equal(issues.find((issue) => issue.code === "offline").severity, "info");
  assert.equal(issues.find((issue) => issue.code === "os-eol").severity, "warning");
});

test("ฮาร์ดดิสก์เสีย แอนตี้ไวรัสปิด และ Windows ไม่ได้ Activate", () => {
  const issues = health.evaluateAgentHealth({
    lastSeenAt: "2026-10-13 07:00:00", operatingSystem: "Windows 11 Pro", ramMb: 16384, agentVersion: "2.0.0", serialNumber: "S1",
    diskTotalGb: 500, diskFreeGb: 300,
    healthJson: JSON.stringify({
      volumes: [{ mount: "C:", totalGb: 500, freeGb: 300, isSystem: true }],
      physicalDisks: [{ model: "WDC", mediaType: "HDD", healthStatus: "Warning", predictFailure: true }],
      antivirus: [{ name: "Defender", enabled: false, upToDate: true }],
      windowsActivation: "Notification",
      lastUpdateInstalledAt: "2026-05-01T00:00:00Z",
    }),
  }, NOW);
  const bySeverity = Object.fromEntries(issues.map((issue) => [issue.code, issue.severity]));
  assert.equal(bySeverity["disk-failing"], "critical");
  assert.equal(bySeverity.antivirus, "critical");
  assert.equal(bySeverity["windows-not-activated"], "warning");
  assert.equal(bySeverity["updates-stale"], "warning");
});

test("สรุปหน้าติดตาม: ไม่นับเครื่องที่ปิดใช้งาน และนับปัญหาตามประเภท", () => {
  const base = { operatingSystem: "Windows 11", ramMb: 8192, agentVersion: "2.0.0", serialNumber: "S", diskTotalGb: 100, diskFreeGb: 50, healthJson: null };
  const summary = health.summarizeAgentMonitor([
    { ...base, id: 1, isActive: true, lastSeenAt: "2026-10-13 07:00:00", diskFreeGb: 2 },
    { ...base, id: 2, isActive: true, lastSeenAt: "2026-10-13 07:00:00" },
    { ...base, id: 3, isActive: false, lastSeenAt: null },
  ], NOW);
  assert.equal(summary.total, 2);
  assert.equal(summary.critical, 1);
  assert.equal(summary.rows[0].device.id, 1);
  assert.equal(summary.issueCounts.find((item) => item.code === "system-disk-low").critical, 1);
});

function agentWith(executeStatement) {
  return loadTs("lib/agent.ts", {
    "@/lib/facility-work-groups": {},
    "@/lib/assets": { findOrCreateSurvey: async () => 1, createAsset: async () => ({ insertId: 8 }), updateAsset: async () => {} },
    "@/lib/mysql": {
      executeStatement,
      selectRows: async (sql) => {
        if (sql.includes("WHERE ad.agent_uuid")) return [{ id: 1, facility_id: 10, agent_uuid: "agent-1", device_fingerprint: "oldfingerprint", linked_asset_id: null, status: "online" }];
        return [];
      },
    },
  });
}

test("รายงานบันทึกเฉพาะข้อมูลที่ตรวจแล้ว เก็บ health แยก และยังทำงานได้ก่อนรัน migration", async () => {
  const writes = [];
  const agent = agentWith(async (sql, values) => {
    if (sql.includes("health_json")) {
      const error = new Error("Unknown column 'health_json'");
      error.code = "ER_BAD_FIELD_ERROR";
      throw error;
    }
    writes.push({ sql, values });
    return { insertId: 1 };
  });
  const result = await agent.reportAgentInventory({
    agentId: "agent-1", agentKey: "k",
    payload: { fingerprint: "newfingerprint1", hostname: "PC-1", deviceType: "Desktop", raw: { huge: "x".repeat(5000) }, collectedAt: "1999-01-01T00:00:00", health: { volumes: [] } },
  });
  assert.equal(result.deviceId, 1);
  const update = writes.find((write) => write.sql.includes("raw_payload_json"));
  const stored = update.values.at(-2);
  assert.ok(!stored.includes("huge"));
  assert.ok(!update.values.includes("1999-01-01 00:00:00"));
});

test("fingerprint ใหม่ชนกับเครื่องอื่น ใช้ fingerprint เดิมแทน", async () => {
  const fingerprints = [];
  const agent = agentWith(async (sql, values) => {
    if (sql.includes("SET device_fingerprint")) {
      fingerprints.push(values[0]);
      if (values[0] === "newfingerprint1") {
        const error = new Error("Duplicate entry");
        error.code = "ER_DUP_ENTRY";
        throw error;
      }
    }
    return { insertId: 1 };
  });
  await agent.reportAgentInventory({ agentId: "agent-1", agentKey: "k", payload: { fingerprint: "newfingerprint1", hostname: "PC-1", deviceType: "Desktop" } });
  assert.deepEqual([...fingerprints], ["newfingerprint1", "oldfingerprint"]);
});
