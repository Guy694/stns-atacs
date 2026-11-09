/**
 * สรุปภาพรวมเครื่องที่ติดตั้ง ATACS Agent สำหรับแดชบอร์ดหน้า "สุขภาพเครื่องคอมพิวเตอร์"
 * ตรรกะล้วน ไม่แตะฐานข้อมูล ทดสอบได้โดยตรง (tests/agent-monitor-summary.test.mjs)
 */
import { parseDbDateTime, parseHealthJson } from "@/lib/agent-health";
import { agentLifecycleState } from "@/lib/agent-uninstall";

/** ค่าเริ่มต้นเดียวกับ app/api/cron/agent-health (AGENT_OFFLINE_MINUTES) */
export const AGENT_OFFLINE_MINUTES_DEFAULT = 300;

/** อ่านเกณฑ์ออฟไลน์ (นาที) แบบเดียวกับ cron ตรวจเครื่องออฟไลน์: ค่าไม่ถูกต้องใช้ 300 และต่ำสุด 5 นาที */
export function agentOfflineThresholdMinutes(raw: string | undefined) {
  const value = Number(raw ?? AGENT_OFFLINE_MINUTES_DEFAULT);
  return Number.isFinite(value) ? Math.max(5, value) : AGENT_OFFLINE_MINUTES_DEFAULT;
}

export type AgentConnectionState = "online" | "offline" | "never";

export const CONNECTION_LABELS: Record<AgentConnectionState, string> = {
  online: "ออนไลน์",
  offline: "ออฟไลน์",
  never: "ยังไม่เคยรายงาน",
};

export function isConnectionState(value: string): value is AgentConnectionState {
  return value === "online" || value === "offline" || value === "never";
}

/**
 * กติกาเดียวกับ findOfflineAgentDevices ใน lib/agent.ts: last_seen_at ว่าง หรือเก่ากว่าเกณฑ์ = ออฟไลน์
 * และเชื่อสถานะ "offline" ที่ cron หรือ Agent บันทึกไว้ในคอลัมน์ status ด้วย
 * แยก "ยังไม่เคยรายงาน" (last_seen_at ว่าง) ออกมาให้เห็นในกราฟ
 */
export function agentConnectionState(
  device: { lastSeenAt: string | null; status?: string | null },
  now: Date,
  thresholdMinutes: number
): AgentConnectionState {
  const lastSeen = parseDbDateTime(device.lastSeenAt);
  if (lastSeen === null) return "never";
  if (device.status === "offline") return "offline";
  return lastSeen < now.getTime() - thresholdMinutes * 60_000 ? "offline" : "online";
}

/**
 * X1: สถานะที่แสดงในหน้าตั้งค่า Agent / หน้าครุภัณฑ์ — คำนวณจากเวลาที่ติดต่อล่าสุดทุกครั้ง
 * ไม่เชื่อคอลัมน์ status = 'online' อย่างเดียว เพราะจะเปลี่ยนเป็น offline ได้ก็ต่อเมื่อ cron agent-health ทำงาน
 */
export function effectiveAgentStatus(
  device: { lastSeenAt: string | null; status?: string | null; isActive: boolean },
  now: Date,
  thresholdMinutes: number
): "online" | "offline" | "inactive" {
  if (!device.isActive) return "inactive";
  return agentConnectionState(device, now, thresholdMinutes) === "online" ? "online" : "offline";
}

export const OS_FAMILIES = [
  { key: "windows-11", label: "Windows 11", warning: false },
  { key: "windows-10", label: "Windows 10", warning: false },
  { key: "windows-legacy", label: "Windows 7/8 (หมดการสนับสนุน)", warning: true },
  { key: "windows-server", label: "Windows Server", warning: false },
  { key: "linux-ubuntu", label: "Linux (Ubuntu)", warning: false },
  { key: "linux-debian", label: "Linux (Debian)", warning: false },
  { key: "linux-other", label: "Linux (อื่น ๆ)", warning: false },
  { key: "macos", label: "macOS", warning: false },
  { key: "unknown", label: "ไม่ทราบ", warning: false },
] as const;

export type OsFamilyKey = (typeof OS_FAMILIES)[number]["key"];

export function isOsFamilyKey(value: string): value is OsFamilyKey {
  return OS_FAMILIES.some((family) => family.key === value);
}

export function osFamilyLabel(key: OsFamilyKey) {
  return OS_FAMILIES.find((family) => family.key === key)?.label ?? key;
}

/** จัดกลุ่มชื่อระบบปฏิบัติการที่ Agent ส่งมา (เช่น "Microsoft Windows 11 Pro") เป็นตระกูลสำหรับกราฟ */
export function osFamily(os: string | null | undefined): OsFamilyKey {
  const text = (os ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text.includes("windows")) {
    if (text.includes("server")) return "windows-server";
    if (/windows\s*11\b/.test(text)) return "windows-11";
    if (/windows\s*10\b/.test(text)) return "windows-10";
    if (/windows\s*(xp|vista|7|8\.1|8)\b/.test(text)) return "windows-legacy";
    return "unknown";
  }
  if (text.includes("ubuntu")) return "linux-ubuntu";
  if (text.includes("debian")) return "linux-debian";
  if (/linux|centos|fedora|red hat|rhel|rocky|alma|suse|mint/.test(text)) return "linux-other";
  if (/macos|mac os|os x|darwin/.test(text)) return "macos";
  return "unknown";
}

function versionParts(value: string | null | undefined): number[] | null {
  const match = (value ?? "").trim().match(/^v?(\d+(?:\.\d+)*)/i);
  return match ? match[1].split(".").map((part) => Number.parseInt(part, 10)) : null;
}

/** เปรียบเทียบรุ่นทีละส่วนแบบตัวเลข (2.10.0 > 2.9.1) รุ่นที่อ่านไม่ได้ถือว่าเก่าสุด */
export function compareAgentVersions(a: string | null | undefined, b: string | null | undefined) {
  const left = versionParts(a);
  const right = versionParts(b);
  if (!left || !right) return left ? 1 : right ? -1 : 0;
  for (let index = 0; index < Math.max(left.length, right.length, 3); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** ไม่ทราบรุ่นนับว่าเป็นรุ่นเก่า (ต้องติดตั้งใหม่) */
export function isAgentOutdated(version: string | null | undefined, latest: string) {
  return !versionParts(version) || compareAgentVersions(version, latest) < 0;
}

/** รูปแบบมาตรฐานสำหรับจัดกลุ่ม: "2.1" กับ "v2.1.0" เป็นรุ่นเดียวกัน */
function canonicalVersion(value: string | null | undefined) {
  const parts = versionParts(value);
  if (!parts) return "";
  while (parts.length < 3) parts.push(0);
  return parts.join(".");
}

export function percentOf(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export type FleetDeviceInput = {
  facilityId: number;
  facilityName: string;
  lastSeenAt: string | null;
  status?: string | null;
  operatingSystem: string | null;
  agentVersion: string | null;
  healthJson?: string | null;
  /** ไม่ส่ง = ถือว่ายังใช้งานอยู่ (false = ลบออกจากระบบแล้ว) */
  isActive?: boolean;
  uninstallRequestedAt?: string | null;
  uninstalledAt?: string | null;
};

export const UNKNOWN_VERSION_LABEL = "ไม่ทราบรุ่น";

export function summarizeAgentFleet(
  devices: FleetDeviceInput[],
  options: { now: Date; latestVersion: string; offlineMinutes: number }
) {
  const connection: Record<AgentConnectionState, number> = { online: 0, offline: 0, never: 0 };
  const osCounts = new Map<OsFamilyKey, number>();
  const versionCounts = new Map<string, number>();
  const facilities = new Map<number, { facilityId: number; facilityName: string; offline: number; total: number }>();
  const activation = { licensed: 0, notLicensed: 0, noData: 0 };
  const antivirus = { ok: 0, disabled: 0, outdated: 0, missing: 0, noData: 0 };
  let outdatedAgents = 0;
  let total = 0;
  /** ถอนการติดตั้งแล้ว/ลบออกจากระบบ: ไม่นับในยอดใด ๆ แสดงเป็นจำนวนแยก */
  let retired = 0;
  /** รอถอนการติดตั้ง (ยังติดตั้งอยู่ จึงยังนับในยอดออนไลน์/ออฟไลน์) */
  let uninstallPending = 0;

  for (const device of devices) {
    const lifecycle = agentLifecycleState({ isActive: device.isActive ?? true, uninstallRequestedAt: device.uninstallRequestedAt, uninstalledAt: device.uninstalledAt });
    if (lifecycle === "retired" || lifecycle === "uninstalled") {
      retired += 1;
      continue;
    }
    if (lifecycle === "uninstall-pending") uninstallPending += 1;
    total += 1;
    const state = agentConnectionState(device, options.now, options.offlineMinutes);
    connection[state] += 1;

    const family = osFamily(device.operatingSystem);
    osCounts.set(family, (osCounts.get(family) ?? 0) + 1);

    const version = canonicalVersion(device.agentVersion);
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
    if (isAgentOutdated(device.agentVersion, options.latestVersion)) outdatedAgents += 1;

    const facility = facilities.get(device.facilityId) ?? { facilityId: device.facilityId, facilityName: device.facilityName, offline: 0, total: 0 };
    facility.total += 1;
    if (state !== "online") facility.offline += 1;
    facilities.set(device.facilityId, facility);

    // ใช้เงื่อนไขเดียวกับ evaluateAgentHealth: Activate ดูเฉพาะ Windows, แอนตี้ไวรัสดูเฉพาะ Windows ที่ไม่ใช่ Server
    const isWindows = family.startsWith("windows") || /windows/i.test(device.operatingSystem ?? "");
    if (!isWindows) continue;
    const health = parseHealthJson(device.healthJson);
    const status = health?.windowsActivation?.toLowerCase();
    if (!status) activation.noData += 1;
    else if (status === "licensed") activation.licensed += 1;
    else activation.notLicensed += 1;

    if (family === "windows-server") continue;
    if (!health) antivirus.noData += 1;
    else if (health.antivirus.length === 0) antivirus.missing += 1;
    else if (!health.antivirus.some((av) => av.enabled !== false)) antivirus.disabled += 1;
    else if (health.antivirus.every((av) => av.upToDate === false)) antivirus.outdated += 1;
    else antivirus.ok += 1;
  }

  const latest = canonicalVersion(options.latestVersion);
  const versions = [...versionCounts.entries()]
    .map(([key, count]) => ({
      key,
      label: key || UNKNOWN_VERSION_LABEL,
      count,
      latest: Boolean(key) && key === latest,
      outdated: isAgentOutdated(key, options.latestVersion),
    }))
    .sort((a, b) => (!a.key ? 1 : !b.key ? -1 : compareAgentVersions(b.key, a.key)));

  return {
    total,
    retired,
    uninstallPending,
    connection,
    os: OS_FAMILIES.filter((family) => osCounts.get(family.key)).map((family) => ({ ...family, count: osCounts.get(family.key) ?? 0 })),
    versions,
    outdatedAgents,
    activation,
    antivirus,
    /** หน่วยงานที่มีเครื่องออฟไลน์ (รวมยังไม่เคยรายงาน) มากที่สุด 10 อันดับ */
    facilitiesByOffline: [...facilities.values()]
      .filter((facility) => facility.offline > 0)
      .sort((a, b) => b.offline - a.offline || b.total - a.total || a.facilityName.localeCompare(b.facilityName, "th"))
      .slice(0, 10),
  };
}

export type AgentFleetSummary = ReturnType<typeof summarizeAgentFleet>;
