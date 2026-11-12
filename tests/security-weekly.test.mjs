import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { weeklyReportPeriod, buildWeeklySecurityDetails, weeklyReportEventKey, weeklyReportDay } = loadTs("lib/security-weekly.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("report is sent on the configured weekday and covers the previous 7 days", () => {
  assert.equal(weeklyReportDay({}), 1, "Monday by default");
  assert.equal(weeklyReportDay({ SECURITY_WEEKLY_REPORT_DAY: "5" }), 5);
  assert.equal(weeklyReportDay({ SECURITY_WEEKLY_REPORT_DAY: "9" }), 1);
  assert.deepEqual(plain(weeklyReportPeriod("2026-11-16", 1)), { due: true, start: "2026-11-09", end: "2026-11-15" });
  assert.equal(weeklyReportPeriod("2026-11-17", 1).due, false);
  assert.equal(weeklyReportEventKey("2026-11-16"), "security-weekly:2026-11-16");
});

const base = {
  period: { start: "2026-11-09", end: "2026-11-15" },
  logins: { succeeded: 120, users: 30, failed: 14, failedIps: 6, lockouts: 1 },
  topIps: [
    { ip: "203.0.113.5", total: 9, location: "เวียดนาม" },
    { ip: "10.0.0.8", total: 3, location: "เครือข่ายภายใน" },
  ],
  foreign: { ips: 2, countries: ["เวียดนาม", "สหรัฐอเมริกา"] },
  agents: { wrongKey: 0, unknown: 4, staleDevices: 1, staleDays: 60 },
  changes: 2,
  visitors: { visits: 840, ips: 75 },
  backup: { ok: true, label: "ล่าสุด 15 พ.ย. 2569 02:00 (2 MB)" },
};

test("formats a readable Telegram summary", () => {
  const details = plain(buildWeeklySecurityDetails(base));
  assert.equal(details["ช่วงเวลา"], "9–15 พ.ย. 2569");
  assert.equal(details["เข้าสู่ระบบสำเร็จ"], "120 ครั้ง (30 คน)");
  assert.equal(details["เข้าสู่ระบบไม่สำเร็จ"], "14 ครั้ง จาก 6 IP · ถูกล็อก 1 ครั้ง");
  assert.equal(details["IP ที่น่าสงสัย"], "203.0.113.5 (เวียดนาม) 9 ครั้ง, 10.0.0.8 (เครือข่ายภายใน) 3 ครั้ง");
  assert.equal(details["IP ต่างประเทศ"], "2 IP · เวียดนาม, สหรัฐอเมริกา");
  assert.equal(details["Agent"], "Agent ที่ไม่มีในระบบ 4 ครั้ง · ไม่ส่งข้อมูลเกิน 60 วัน 1 เครื่อง");
  assert.equal(details["เปลี่ยนการตั้งค่าความปลอดภัย"], "2 ครั้ง");
  assert.equal(details["ผู้เข้าชมเว็บไซต์"], "840 ครั้ง จาก 75 IP");
  assert.equal(details["Backup ฐานข้อมูล"], "✅ ล่าสุด 15 พ.ย. 2569 02:00 (2 MB)");
  assert.equal(details["สรุป"], "⚠️ มีเรื่องที่ควรดู: บัญชีถูกล็อก, IP ต่างประเทศ, Agent ที่ไม่ส่งข้อมูล");
});

test("a quiet week says so and omits empty lines", () => {
  const details = plain(
    buildWeeklySecurityDetails({
      ...base,
      logins: { succeeded: 50, users: 10, failed: 0, failedIps: 0, lockouts: 0 },
      topIps: [],
      foreign: { ips: 0, countries: [] },
      agents: { wrongKey: 0, unknown: 0, staleDevices: 0, staleDays: 60 },
      changes: 0,
    })
  );
  assert.equal(details["เข้าสู่ระบบไม่สำเร็จ"], "ไม่มี");
  assert.equal(details["IP ที่น่าสงสัย"], undefined);
  assert.equal(details["IP ต่างประเทศ"], undefined);
  assert.equal(details["Agent"], "ปกติ");
  assert.equal(details["สรุป"], "✅ ปกติ ไม่มีเรื่องผิดปกติ");
});

test("wrong agent keys, lockouts and a failed backup are flagged", () => {
  const details = plain(
    buildWeeklySecurityDetails({ ...base, agents: { ...base.agents, wrongKey: 3 }, backup: { ok: false, label: "ไม่พบไฟล์ใน 2 วัน" }, foreign: { ips: 0, countries: [] } })
  );
  assert.equal(details["Agent"], "กุญแจผิด 3 ครั้ง · Agent ที่ไม่มีในระบบ 4 ครั้ง · ไม่ส่งข้อมูลเกิน 60 วัน 1 เครื่อง");
  assert.equal(details["Backup ฐานข้อมูล"], "❌ ไม่พบไฟล์ใน 2 วัน");
  assert.match(details["สรุป"], /บัญชีถูกล็อก.*กุญแจ Agent ผิด.*Backup/);
});
