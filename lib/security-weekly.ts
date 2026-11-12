/**
 * N4: รายงานความปลอดภัยรายสัปดาห์ทาง Telegram (ส่งพร้อมงาน daily-summary ในวันที่กำหนด ค่าเริ่มต้นวันจันทร์)
 * ไฟล์นี้ไม่แตะฐานข้อมูล
 */

export function weeklyReportDay(env: Record<string, string | undefined>) {
  const day = Number(env.SECURITY_WEEKLY_REPORT_DAY);
  return Number.isInteger(day) && day >= 0 && day <= 6 ? day : 1;
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** `today` = วันที่ไทย YYYY-MM-DD · ครอบคลุม 7 วันก่อนหน้า (ไม่รวมวันนี้) */
export function weeklyReportPeriod(today: string, reportDay: number) {
  const due = new Date(`${today}T00:00:00Z`).getUTCDay() === reportDay;
  return { due, start: addDays(today, -7), end: addDays(today, -1) };
}

export function weeklyReportEventKey(today: string) {
  return `security-weekly:${today}`;
}

export type WeeklySecurityData = {
  period: { start: string; end: string };
  logins: { succeeded: number; users: number; failed: number; failedIps: number; lockouts: number };
  topIps: { ip: string; total: number; location: string | null }[];
  foreign: { ips: number; countries: string[] };
  agents: { wrongKey: number; unknown: number; staleDevices: number; staleDays: number };
  changes: number;
  visitors: { visits: number; ips: number };
  backup: { ok: boolean; label: string };
};

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const n = (value: number) => value.toLocaleString("th-TH");

function thaiRange(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[em - 1]} ${ey + 543}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey + 543}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy + 543} – ${ed} ${MONTHS[em - 1]} ${ey + 543}`;
}

export function buildWeeklySecurityDetails(data: WeeklySecurityData): Record<string, string> {
  const { logins, agents } = data;
  const details: Record<string, string> = { ช่วงเวลา: thaiRange(data.period.start, data.period.end) };

  details["เข้าสู่ระบบสำเร็จ"] = `${n(logins.succeeded)} ครั้ง (${n(logins.users)} คน)`;
  details["เข้าสู่ระบบไม่สำเร็จ"] =
    logins.failed === 0
      ? "ไม่มี"
      : `${n(logins.failed)} ครั้ง จาก ${n(logins.failedIps)} IP${logins.lockouts ? ` · ถูกล็อก ${n(logins.lockouts)} ครั้ง` : ""}`;
  if (data.topIps.length) {
    details["IP ที่น่าสงสัย"] = data.topIps
      .slice(0, 3)
      .map((row) => `${row.ip}${row.location ? ` (${row.location})` : ""} ${n(row.total)} ครั้ง`)
      .join(", ");
  }
  if (data.foreign.ips) details["IP ต่างประเทศ"] = `${n(data.foreign.ips)} IP · ${data.foreign.countries.slice(0, 5).join(", ")}`;

  const agentParts = [
    agents.wrongKey && `กุญแจผิด ${n(agents.wrongKey)} ครั้ง`,
    agents.unknown && `Agent ที่ไม่มีในระบบ ${n(agents.unknown)} ครั้ง`,
    agents.staleDevices && `ไม่ส่งข้อมูลเกิน ${n(agents.staleDays)} วัน ${n(agents.staleDevices)} เครื่อง`,
  ].filter(Boolean);
  details["Agent"] = agentParts.length ? agentParts.join(" · ") : "ปกติ";
  details["เปลี่ยนการตั้งค่าความปลอดภัย"] = data.changes ? `${n(data.changes)} ครั้ง` : "ไม่มี";
  details["ผู้เข้าชมเว็บไซต์"] = `${n(data.visitors.visits)} ครั้ง จาก ${n(data.visitors.ips)} IP`;
  details["Backup ฐานข้อมูล"] = `${data.backup.ok ? "✅" : "❌"} ${data.backup.label}`;

  const flags = [
    logins.lockouts > 0 && "บัญชีถูกล็อก",
    agents.wrongKey > 0 && "กุญแจ Agent ผิด",
    data.foreign.ips > 0 && "IP ต่างประเทศ",
    agents.staleDevices > 0 && "Agent ที่ไม่ส่งข้อมูล",
    !data.backup.ok && "Backup",
  ].filter(Boolean);
  details["สรุป"] = flags.length ? `⚠️ มีเรื่องที่ควรดู: ${flags.join(", ")}` : "✅ ปกติ ไม่มีเรื่องผิดปกติ";
  return details;
}
