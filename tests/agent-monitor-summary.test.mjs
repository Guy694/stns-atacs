import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const summary = loadTs("lib/agent-monitor-summary.ts");
// ผลจาก vm อยู่คนละ realm: แปลงเป็น JSON ก่อนเทียบ
const plain = (value) => JSON.parse(JSON.stringify(value));
const NOW = new Date("2026-11-05T03:00:00Z"); // 10:00 เวลาไทย

const device = (patch = {}) => ({
  id: 1,
  facilityId: 1,
  facilityName: "รพ.สต.ทดสอบ",
  lastSeenAt: "2026-11-05T09:30:00+07:00",
  status: "online",
  operatingSystem: "Microsoft Windows 11 Pro",
  agentVersion: "2.1.0",
  healthJson: null,
  ...patch,
});

test("จัดกลุ่มระบบปฏิบัติการ", () => {
  const cases = [
    ["Microsoft Windows 11 Pro", "windows-11"],
    ["Windows 10 Enterprise LTSC", "windows-10"],
    ["Microsoft Windows 10 Pro", "windows-10"],
    ["Windows Server 2019 Standard", "windows-server"],
    ["Microsoft Windows Server 2012 R2 Standard", "windows-server"],
    ["Microsoft Windows 7 Professional", "windows-legacy"],
    ["Windows 8.1 Pro", "windows-legacy"],
    ["Windows XP Professional", "windows-legacy"],
    ["Ubuntu 22.04.4 LTS", "linux-ubuntu"],
    ["Debian GNU/Linux 12 (bookworm)", "linux-debian"],
    ["CentOS Linux 7", "linux-other"],
    ["macOS 14.5", "macos"],
    ["Mac OS X 10.15", "macos"],
    [null, "unknown"],
    ["", "unknown"],
    ["   ", "unknown"],
    ["Something else", "unknown"],
  ];
  for (const [os, key] of cases) assert.equal(summary.osFamily(os), key, String(os));
  assert.ok(summary.OS_FAMILIES.find((item) => item.key === "windows-legacy").warning);
  assert.equal(summary.OS_FAMILIES.find((item) => item.key === "windows-11").warning, false);
  assert.ok(summary.isOsFamilyKey("windows-11"));
  assert.equal(summary.isOsFamilyKey("nope"), false);
});

test("เปรียบเทียบรุ่น Agent แบบตัวเลข", () => {
  assert.equal(summary.compareAgentVersions("2.10.0", "2.9.1"), 1);
  assert.equal(summary.compareAgentVersions("2.9.1", "2.10.0"), -1);
  assert.equal(summary.compareAgentVersions("v2.1.0", "2.1"), 0);
  assert.equal(summary.isAgentOutdated("2.0.9", "2.1.0"), true);
  assert.equal(summary.isAgentOutdated("2.10.0", "2.9.1"), false);
  assert.equal(summary.isAgentOutdated("2.2.0", "2.2.0"), false);
  assert.equal(summary.isAgentOutdated(null, "2.1.0"), true);
  assert.equal(summary.isAgentOutdated("", "2.1.0"), true);
});

test("เกณฑ์ออฟไลน์อ่านจาก AGENT_OFFLINE_MINUTES เหมือน cron (ค่าเริ่มต้น 300 นาที ต่ำสุด 5)", () => {
  assert.equal(summary.agentOfflineThresholdMinutes(undefined), 300);
  assert.equal(summary.agentOfflineThresholdMinutes("abc"), 300);
  assert.equal(summary.agentOfflineThresholdMinutes("60"), 60);
  assert.equal(summary.agentOfflineThresholdMinutes("1"), 5);
});

test("สถานะการเชื่อมต่อ: ออนไลน์ / ออฟไลน์ / ยังไม่เคยรายงาน", () => {
  const state = (patch) => summary.agentConnectionState(device(patch), NOW, 300);
  assert.equal(state({}), "online");
  assert.equal(state({ lastSeenAt: "2026-11-05T05:01:00+07:00" }), "online"); // 299 นาที
  assert.equal(state({ lastSeenAt: "2026-11-05T04:59:00+07:00" }), "offline"); // 301 นาที
  assert.equal(state({ lastSeenAt: "2026-11-05 04:59:00" }), "offline"); // เวลาไทยไม่มี offset
  assert.equal(state({ status: "offline" }), "offline"); // cron หรือ Agent แจ้งว่าออฟไลน์
  assert.equal(state({ lastSeenAt: null }), "never");
});

test("สรุปภาพรวม: นับการเชื่อมต่อ OS รุ่น Agent และหน่วยงาน", () => {
  const devices = [
    device({ id: 1 }),
    device({ id: 2, lastSeenAt: "2026-11-01T09:00:00+07:00", operatingSystem: "Windows 10 Enterprise LTSC", agentVersion: "2.0.0" }),
    device({ id: 3, facilityId: 2, facilityName: "รพ.สต.สอง", lastSeenAt: "2026-11-01T09:00:00+07:00", operatingSystem: "Microsoft Windows 7 Professional", agentVersion: null }),
    device({ id: 4, facilityId: 2, facilityName: "รพ.สต.สอง", lastSeenAt: null, operatingSystem: null, agentVersion: "2.10.0" }),
    device({ id: 5, operatingSystem: "Ubuntu 22.04.4 LTS", agentVersion: "2.0.0" }),
  ];
  const result = summary.summarizeAgentFleet(devices, { now: NOW, latestVersion: "2.9.1", offlineMinutes: 300 });
  assert.equal(result.total, 5);
  assert.deepEqual(plain(result.connection), { online: 2, offline: 2, never: 1 });
  assert.deepEqual(plain(result.os.map((item) => [item.key, item.count])), [
    ["windows-11", 1],
    ["windows-10", 1],
    ["windows-legacy", 1],
    ["linux-ubuntu", 1],
    ["unknown", 1],
  ]);
  // รุ่นใหม่สุดอยู่บน ไม่ทราบรุ่นอยู่ท้าย
  assert.deepEqual(plain(result.versions.map((item) => [item.label, item.count, item.latest, item.outdated])), [
    ["2.10.0", 1, false, false],
    ["2.1.0", 1, false, true],
    ["2.0.0", 2, false, true],
    ["ไม่ทราบรุ่น", 1, false, true],
  ]);
  assert.equal(result.outdatedAgents, 4);
  assert.deepEqual(plain(result.facilitiesByOffline.map((item) => [item.facilityId, item.offline, item.total])), [
    [2, 2, 2],
    [1, 1, 3],
  ]);
});

test("ทำเครื่องหมายรุ่นล่าสุด และรวมรุ่นที่เขียนต่างกันเป็นกลุ่มเดียว", () => {
  const result = summary.summarizeAgentFleet(
    [device({ agentVersion: "2.1.0" }), device({ id: 2, agentVersion: "2.1" }), device({ id: 3, agentVersion: "1.9.0" })],
    { now: NOW, latestVersion: "2.1.0", offlineMinutes: 300 }
  );
  assert.deepEqual(plain(result.versions.map((item) => [item.label, item.count, item.latest, item.outdated])), [
    ["2.1.0", 2, true, false],
    ["1.9.0", 1, false, true],
  ]);
});

test("หน่วยงานที่ไม่มีเครื่องออฟไลน์ไม่ติดอันดับ และจำกัด 10 อันดับ", () => {
  const devices = Array.from({ length: 12 }, (_, index) =>
    device({ id: index + 1, facilityId: index + 1, facilityName: `F${index + 1}`, lastSeenAt: index === 11 ? NOW.toISOString() : null })
  );
  const result = summary.summarizeAgentFleet(devices, { now: NOW, latestVersion: "2.1.0", offlineMinutes: 300 });
  assert.equal(result.facilitiesByOffline.length, 10);
  assert.ok(result.facilitiesByOffline.every((item) => item.offline > 0));
});

test("สรุป Activate Windows และแอนตี้ไวรัสจากข้อมูลสุขภาพ (เฉพาะ Windows)", () => {
  const health = (value) => JSON.stringify({ volumes: [], physicalDisks: [], antivirus: [], ...value });
  const devices = [
    device({ id: 1, healthJson: health({ windowsActivation: "Licensed", antivirus: [{ name: "Defender", enabled: true, upToDate: true }] }) }),
    device({ id: 2, healthJson: health({ windowsActivation: "Notification", antivirus: [{ name: "Defender", enabled: false, upToDate: true }] }) }),
    device({ id: 3, healthJson: health({ antivirus: [{ name: "Defender", enabled: true, upToDate: false }] }) }),
    device({ id: 4, healthJson: health({}) }),
    device({ id: 5 }),
    device({ id: 6, operatingSystem: "Ubuntu 22.04.4 LTS", healthJson: health({}) }),
    device({ id: 7, operatingSystem: "Windows Server 2019 Standard", healthJson: health({ windowsActivation: "Licensed" }) }),
  ];
  const result = summary.summarizeAgentFleet(devices, { now: NOW, latestVersion: "2.1.0", offlineMinutes: 300 });
  assert.deepEqual(plain(result.activation), { licensed: 2, notLicensed: 1, noData: 3 });
  assert.deepEqual(plain(result.antivirus), { ok: 1, disabled: 1, outdated: 1, missing: 1, noData: 1 });
});

test("ร้อยละปัดเป็นจำนวนเต็มและไม่หารด้วยศูนย์", () => {
  assert.equal(summary.percentOf(1, 3), 33);
  assert.equal(summary.percentOf(2, 3), 67);
  assert.equal(summary.percentOf(0, 0), 0);
});

test("X1: effective status ignores a stale 'online' in the DB when the cron did not run", () => {
  const now = new Date("2026-11-09T12:00:00+07:00");
  const stale = { lastSeenAt: "2026-06-26T10:00:00+07:00", status: "online", isActive: true };
  const fresh = { lastSeenAt: "2026-11-09T11:30:00+07:00", status: "online", isActive: true };
  assert.equal(summary.effectiveAgentStatus(stale, now, 300), "offline");
  assert.equal(summary.effectiveAgentStatus(fresh, now, 300), "online");
  assert.equal(summary.effectiveAgentStatus({ ...fresh, status: "offline" }, now, 300), "offline", "trust an explicit offline");
  assert.equal(summary.effectiveAgentStatus({ lastSeenAt: null, status: "online", isActive: true }, now, 300), "offline", "never reported is not online");
  assert.equal(summary.effectiveAgentStatus({ ...fresh, isActive: false }, now, 300), "inactive");
});
