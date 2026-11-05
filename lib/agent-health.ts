/**
 * วิเคราะห์ "สุขภาพเครื่อง" จากข้อมูลที่ ATACS Agent ส่งมา สำหรับหน้าติดตามของเจ้าหน้าที่ IT
 * ตรรกะล้วน ไม่แตะฐานข้อมูล ทดสอบได้โดยตรง
 */
import { AGENT_LATEST_VERSION, cleanAgentHealth, compareVersions, type AgentHealth } from "@/lib/agent-payload";

export type HealthSeverity = "critical" | "warning" | "info";

export type HealthIssueCode =
  | "offline"
  | "system-disk-low"
  | "disk-low"
  | "disk-failing"
  | "memory-low"
  | "memory-pressure"
  | "os-eol"
  | "windows-not-activated"
  | "antivirus"
  | "updates-stale"
  | "pending-reboot"
  | "long-uptime"
  | "battery"
  | "agent-outdated"
  | "no-serial";

export type HealthIssue = { code: HealthIssueCode; severity: HealthSeverity; title: string; detail: string };

export const HEALTH_ISSUE_LABELS: Record<HealthIssueCode, string> = {
  offline: "ไม่ส่งข้อมูล",
  "system-disk-low": "ไดรฟ์ระบบใกล้เต็ม",
  "disk-low": "ไดรฟ์ข้อมูลใกล้เต็ม",
  "disk-failing": "ฮาร์ดดิสก์มีปัญหา",
  "memory-low": "RAM น้อย",
  "memory-pressure": "หน่วยความจำใช้สูง",
  "os-eol": "ระบบปฏิบัติการหมดการสนับสนุน",
  "windows-not-activated": "Windows ไม่ได้ Activate",
  antivirus: "โปรแกรมป้องกันไวรัส",
  "updates-stale": "ไม่ได้อัปเดต Windows",
  "pending-reboot": "รอรีสตาร์ท",
  "long-uptime": "เปิดเครื่องต่อเนื่องนาน",
  battery: "แบตเตอรี่เสื่อม",
  "agent-outdated": "Agent รุ่นเก่า",
  "no-serial": "ไม่มี Serial Number",
};

export const SEVERITY_RANK: Record<HealthSeverity, number> = { critical: 3, warning: 2, info: 1 };
export const SEVERITY_LABELS: Record<HealthSeverity, string> = { critical: "วิกฤต", warning: "ควรแก้ไข", info: "แจ้งให้ทราบ" };

export type HealthDeviceInput = {
  lastSeenAt: string | null;
  operatingSystem: string | null;
  ramMb: number | null;
  agentVersion: string | null;
  serialNumber: string | null;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  healthJson?: string | null;
};

const DAY = 86_400_000;
const gb = (value: number) => `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })} GB`;

/**
 * เวลาจาก lib/agent.ts มาเป็น ISO พร้อม offset (+07:00) อยู่แล้ว (ดู agentTimestamp)
 * ค่าแบบไม่มี offset "YYYY-MM-DD HH:mm:ss" คือเวลาไทยตามที่ฐานข้อมูลเก็บ (NOW() ของ MySQL +07:00) ไม่ใช่ UTC
 */
export function parseDbDateTime(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.trim().replace(" ", "T")}+07:00`);
  return Number.isFinite(time) ? time : null;
}

export function parseHealthJson(value: string | null | undefined): AgentHealth | null {
  if (!value) return null;
  try {
    return cleanAgentHealth(JSON.parse(value));
  } catch {
    return null;
  }
}

/** สถานะ OS ที่หมดการสนับสนุนจากผู้ผลิต (ณ ปี 2569) */
export function operatingSystemEol(os: string | null | undefined): { severity: HealthSeverity; label: string } | null {
  const text = (os ?? "").toLowerCase();
  if (!text.includes("windows")) return null;
  if (/server\s*(2003|2008|2012)/.test(text)) return { severity: "critical", label: "Windows Server รุ่นนี้หมดการสนับสนุนด้านความปลอดภัยแล้ว" };
  if (text.includes("server")) return null;
  if (/windows\s*(xp|vista|7|8\.1|8)\b/.test(text)) return { severity: "critical", label: "หมดการสนับสนุนด้านความปลอดภัยมานานแล้ว ควรเปลี่ยนหรืออัปเกรดโดยเร็ว" };
  if (/windows\s*10\b/.test(text)) return { severity: "warning", label: "Windows 10 หมดการสนับสนุนเมื่อ 14 ต.ค. 2568 ควรวางแผนอัปเกรดเป็น Windows 11" };
  return null;
}

function volumeIssue(volume: { mount: string; totalGb: number; freeGb: number }, system: boolean): HealthIssue | null {
  const percent = volume.totalGb > 0 ? (volume.freeGb / volume.totalGb) * 100 : 100;
  const detail = `${volume.mount} เหลือ ${gb(volume.freeGb)} จาก ${gb(volume.totalGb)} (${percent.toFixed(0)}%)`;
  if (system) {
    if (volume.freeGb < 5 || percent < 5) return { code: "system-disk-low", severity: "critical", title: "ไดรฟ์ระบบเกือบเต็ม", detail: `${detail} — เครื่องอาจช้า อัปเดตไม่ได้ หรือบูตไม่ขึ้น` };
    if (volume.freeGb < 15 || percent < 10) return { code: "system-disk-low", severity: "warning", title: "ไดรฟ์ระบบใกล้เต็ม", detail };
    return null;
  }
  if (percent < 5) return { code: "disk-low", severity: "warning", title: "ไดรฟ์ข้อมูลใกล้เต็ม", detail };
  return null;
}

export function evaluateAgentHealth(device: HealthDeviceInput, now = new Date()): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const health = parseHealthJson(device.healthJson);
  const nowMs = now.getTime();

  const lastSeen = parseDbDateTime(device.lastSeenAt);
  if (lastSeen === null) {
    issues.push({ code: "offline", severity: "warning", title: "ยังไม่เคยส่งข้อมูล", detail: "ติดตั้ง Agent แล้วแต่ยังไม่ได้รับรายงาน" });
  } else {
    const days = Math.floor((nowMs - lastSeen) / DAY);
    if (days >= 14) issues.push({ code: "offline", severity: "warning", title: `ไม่ส่งข้อมูล ${days} วัน`, detail: "เครื่องอาจปิด ย้าย จำหน่าย หรือ Agent หยุดทำงาน" });
    else if (days >= 3) issues.push({ code: "offline", severity: "info", title: `ไม่ส่งข้อมูล ${days} วัน`, detail: "ตรวจว่าเครื่องเปิดใช้งานอยู่หรือไม่" });
  }

  // พื้นที่ดิสก์: ใช้ข้อมูลรายไดรฟ์จาก Agent 2.x ถ้าไม่มีใช้ยอดรวมจากรุ่นเก่า
  if (health && health.volumes.length) {
    const hasSystem = health.volumes.some((volume) => volume.isSystem);
    for (const volume of health.volumes) {
      const issue = volumeIssue(volume, volume.isSystem || (!hasSystem && /^(c:|\/)$/i.test(volume.mount)));
      if (issue) issues.push(issue);
    }
  } else if (device.diskTotalGb && device.diskFreeGb !== null) {
    const issue = volumeIssue({ mount: "ดิสก์ทั้งหมด", totalGb: device.diskTotalGb, freeGb: device.diskFreeGb }, true);
    if (issue) issues.push(issue);
  }

  for (const disk of health?.physicalDisks ?? []) {
    const status = (disk.healthStatus ?? "").toLowerCase();
    if (disk.predictFailure || (status && status !== "healthy" && status !== "ok")) {
      issues.push({
        code: "disk-failing",
        severity: disk.predictFailure || status === "unhealthy" ? "critical" : "warning",
        title: "ฮาร์ดดิสก์แจ้งเตือนความเสียหาย",
        detail: `${disk.model ?? "ดิสก์"}${disk.mediaType ? ` (${disk.mediaType})` : ""} สถานะ ${disk.healthStatus ?? "คาดว่าจะเสีย"} — ควรสำรองข้อมูลทันที`,
      });
    }
  }

  const ramMb = health?.memoryTotalMb ?? device.ramMb;
  const os = device.operatingSystem ?? "";
  if (ramMb && /windows/i.test(os) && ramMb < 3900) {
    issues.push({ code: "memory-low", severity: ramMb < 1900 ? "warning" : "info", title: "RAM น้อย", detail: `มี RAM ${(ramMb / 1024).toFixed(1)} GB — Windows 10/11 ควรมีอย่างน้อย 8 GB สำหรับงานทั่วไป` });
  }
  if (health?.memoryTotalMb && health.memoryAvailableMb !== null) {
    const used = 100 - (health.memoryAvailableMb / health.memoryTotalMb) * 100;
    if (used >= 90) issues.push({ code: "memory-pressure", severity: "info", title: "หน่วยความจำใช้สูง", detail: `ขณะส่งรายงานใช้ RAM ${used.toFixed(0)}%` });
  }

  const eol = operatingSystemEol(os);
  if (eol) issues.push({ code: "os-eol", severity: eol.severity, title: os, detail: eol.label });

  const activation = health?.windowsActivation?.toLowerCase();
  if (activation && activation !== "licensed") {
    issues.push({ code: "windows-not-activated", severity: "warning", title: "Windows ไม่ได้ Activate", detail: `สถานะลิขสิทธิ์: ${health?.windowsActivation} — ตรวจสอบลิขสิทธิ์และบันทึกในทะเบียน` });
  }

  if (health && /windows/i.test(os) && !/server/i.test(os)) {
    if (health.antivirus.length === 0) {
      issues.push({ code: "antivirus", severity: "info", title: "ไม่พบข้อมูลโปรแกรมป้องกันไวรัส", detail: "Agent อ่านสถานะจาก Windows Security ไม่ได้" });
    } else if (!health.antivirus.some((av) => av.enabled !== false)) {
      issues.push({ code: "antivirus", severity: "critical", title: "โปรแกรมป้องกันไวรัสถูกปิด", detail: health.antivirus.map((av) => av.name).join(", ") });
    } else if (health.antivirus.every((av) => av.upToDate === false)) {
      issues.push({ code: "antivirus", severity: "warning", title: "ฐานข้อมูลไวรัสไม่เป็นปัจจุบัน", detail: health.antivirus.map((av) => av.name).join(", ") });
    }
  }

  const lastUpdate = health?.lastUpdateInstalledAt ? Date.parse(health.lastUpdateInstalledAt) : null;
  if (lastUpdate && /windows/i.test(os)) {
    const days = Math.floor((nowMs - lastUpdate) / DAY);
    if (days > 90) issues.push({ code: "updates-stale", severity: "warning", title: `ไม่ได้ติดตั้งอัปเดตมา ${days} วัน`, detail: "ตรวจ Windows Update หรือ WSUS ของหน่วยงาน" });
  }

  if (health?.pendingReboot) {
    issues.push({ code: "pending-reboot", severity: "info", title: "รอรีสตาร์ทเพื่อติดตั้งอัปเดต", detail: "ให้ผู้ใช้รีสตาร์ทเครื่องเมื่อสะดวก" });
  }
  const boot = health?.lastBootAt ? Date.parse(health.lastBootAt) : null;
  if (boot) {
    const days = Math.floor((nowMs - boot) / DAY);
    if (days >= 30) issues.push({ code: "long-uptime", severity: "info", title: `เปิดเครื่องต่อเนื่อง ${days} วัน`, detail: "ควรรีสตาร์ทเป็นระยะเพื่อให้อัปเดตมีผล" });
  }

  if (health?.batteryHealthPercent !== null && health?.batteryHealthPercent !== undefined && health.batteryHealthPercent < 50) {
    issues.push({ code: "battery", severity: "info", title: "แบตเตอรี่เสื่อม", detail: `ความจุเหลือ ${health.batteryHealthPercent.toFixed(0)}% ของความจุเดิม` });
  }

  if (compareVersions(device.agentVersion, AGENT_LATEST_VERSION) < 0) {
    issues.push({ code: "agent-outdated", severity: "info", title: `Agent รุ่น ${device.agentVersion ?? "ไม่ทราบ"}`, detail: `รุ่นล่าสุด ${AGENT_LATEST_VERSION} — ติดตั้งใหม่เพื่อให้ได้ข้อมูลสุขภาพเครื่องครบ` });
  }
  if (!device.serialNumber) {
    issues.push({ code: "no-serial", severity: "info", title: "ไม่มี Serial Number", detail: "BIOS ไม่ได้ระบุ Serial — กรอกในทะเบียนเองเพื่อใช้ตรวจนับ" });
  }

  return issues.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export function worstSeverity(issues: HealthIssue[]): HealthSeverity | null {
  return issues.reduce<HealthSeverity | null>((worst, issue) => (!worst || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[worst] ? issue.severity : worst), null);
}

/** ไดรฟ์ระบบ (C: หรือ /) สำหรับแสดงแถบความจุ */
export function systemVolume(device: HealthDeviceInput) {
  const health = parseHealthJson(device.healthJson);
  const volume = health?.volumes.find((item) => item.isSystem) ?? health?.volumes.find((item) => /^(c:|\/)$/i.test(item.mount));
  if (volume) return { mount: volume.mount, totalGb: volume.totalGb, freeGb: volume.freeGb };
  if (device.diskTotalGb && device.diskFreeGb !== null) return { mount: "รวม", totalGb: device.diskTotalGb, freeGb: device.diskFreeGb };
  return null;
}

export type MonitorDeviceInput = HealthDeviceInput & { id: number; isActive: boolean; uninstalledAt?: string | null };

/** สรุปสำหรับหน้าติดตามสุขภาพเครื่อง: แถวเรียงจากปัญหาหนักสุด + ยอดรวม */
export function summarizeAgentMonitor<T extends MonitorDeviceInput>(devices: T[], now = new Date()) {
  const rows = devices
    // ถอนการติดตั้งแล้ว/ลบออกจากระบบ ไม่อยู่ในหน้าติดตามสุขภาพเครื่อง
    .filter((device) => device.isActive && !device.uninstalledAt)
    .map((device) => {
      const issues = evaluateAgentHealth(device, now);
      return { device, issues, worst: worstSeverity(issues), volume: systemVolume(device), hasHealth: Boolean(parseHealthJson(device.healthJson)) };
    })
    .sort((a, b) => (b.worst ? SEVERITY_RANK[b.worst] : 0) - (a.worst ? SEVERITY_RANK[a.worst] : 0) || b.issues.length - a.issues.length);

  const issueCounts = new Map<HealthIssueCode, { critical: number; warning: number; info: number }>();
  for (const row of rows) {
    for (const issue of row.issues) {
      const count = issueCounts.get(issue.code) ?? { critical: 0, warning: 0, info: 0 };
      count[issue.severity] += 1;
      issueCounts.set(issue.code, count);
    }
  }
  const recentMs = now.getTime() - 3 * DAY;
  return {
    rows,
    total: rows.length,
    reportingRecently: rows.filter((row) => (parseDbDateTime(row.device.lastSeenAt) ?? 0) >= recentMs).length,
    critical: rows.filter((row) => row.worst === "critical").length,
    warning: rows.filter((row) => row.worst === "warning").length,
    withHealthData: rows.filter((row) => row.hasHealth).length,
    issueCounts: [...issueCounts.entries()]
      .map(([code, count]) => ({ code, label: HEALTH_ISSUE_LABELS[code], ...count, total: count.critical + count.warning + count.info }))
      .sort((a, b) => b.critical - a.critical || b.warning - a.warning || b.total - a.total),
  };
}
