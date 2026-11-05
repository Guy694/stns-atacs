/**
 * ตรวจและทำความสะอาดข้อมูลที่ ATACS Agent ส่งมา (SEC-15 / SEC-32)
 *
 * หลักการ: ไม่เชื่อค่าจากเครื่องลูกข่าย ทุกช่องถูกแปลงชนิด ตัดความยาวตามคอลัมน์ในฐานข้อมูล
 * และตัดค่าขยะที่ BIOS ชอบส่งมา (เช่น "To be filled by O.E.M.") ทิ้ง
 * ไฟล์นี้ไม่แตะฐานข้อมูล จึงทดสอบได้โดยตรง
 */

export const AGENT_LATEST_VERSION = "2.2.0";
/** ขนาดสูงสุดของ body ที่ /api/agent/report ยอมรับ */
export const AGENT_REPORT_MAX_BYTES = 256 * 1024;

export type AgentVolume = {
  mount: string;
  label: string | null;
  fileSystem: string | null;
  totalGb: number;
  freeGb: number;
  isSystem: boolean;
};

export type AgentPhysicalDisk = {
  model: string | null;
  mediaType: string | null;
  sizeGb: number | null;
  healthStatus: string | null;
  predictFailure: boolean | null;
};

export type AgentAntivirus = { name: string; enabled: boolean | null; upToDate: boolean | null };

export type AgentHealth = {
  volumes: AgentVolume[];
  memoryTotalMb: number | null;
  memoryAvailableMb: number | null;
  cpuLoadPercent: number | null;
  lastBootAt: string | null;
  physicalDisks: AgentPhysicalDisk[];
  windowsActivation: string | null;
  antivirus: AgentAntivirus[];
  lastUpdateInstalledAt: string | null;
  pendingReboot: boolean | null;
  batteryHealthPercent: number | null;
};

export type CleanAgentReport = {
  fingerprint: string;
  hostname: string | null;
  serialNumber: string | null;
  biosSerial: string | null;
  deviceType: string | null;
  manufacturerBrand: string | null;
  manufacturerModel: string | null;
  operatingSystem: string | null;
  operatingSystemVersion: string | null;
  privateIp: string | null;
  macAddress: string | null;
  currentUser: string | null;
  cpuModel: string | null;
  ramMb: number | null;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  diskUsedGb: number | null;
  locationDetail: string | null;
  agentVersion: string | null;
  status: "online" | "offline";
  health: AgentHealth | null;
};

type Unknown = Record<string, unknown>;

const isObject = (value: unknown): value is Unknown => typeof value === "object" && value !== null && !Array.isArray(value);

/** ข้อความ: ตัดอักขระควบคุม ช่องว่างหัวท้าย และตัดความยาว ค่าว่างคืน null */
export function cleanText(value: unknown, max = 255): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

/** ตัวเลขในช่วงที่กำหนด นอกช่วงหรือไม่ใช่ตัวเลขคืน null */
export function cleanNumber(value: unknown, min: number, max: number, decimals = 0): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function cleanBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

const JUNK_SERIAL =
  /^(to be filled.*|default string|system serial number|chassis serial number|base ?board serial number|serial ?number|not specified|not applicable|not available|none|null|n\/?a|unknown|invalid|o\.?e\.?m\.?|oem|123456789|1234567890|0123456789|[0x.\- _]+|f{8,}|[*#?]+)$/i;

/** Serial ที่ใช้ระบุเครื่องได้จริง (ตัด placeholder ที่ BIOS ส่งมา) */
export function cleanSerial(value: unknown): string | null {
  const text = cleanText(value, 255);
  if (!text || text.length < 3 || JUNK_SERIAL.test(text)) return null;
  return text;
}

export function cleanIpv4(value: unknown): string | null {
  const text = cleanText(value, 45);
  if (!text) return null;
  const parts = text.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  if (text.startsWith("127.") || text.startsWith("169.254.") || text === "0.0.0.0") return null;
  return text;
}

export function cleanMac(value: unknown): string | null {
  const text = cleanText(value, 64);
  if (!text) return null;
  const hex = text.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (hex.length !== 12 || /^0+$/.test(hex) || /^F+$/.test(hex)) return null;
  return hex.match(/.{2}/g)!.join(":");
}

export function cleanFingerprint(value: unknown): string | null {
  // ไม่ตัดความยาว: fingerprint ที่ยาวเกินคือค่าผิด ไม่ใช่ค่าที่ตัดแล้วใช้ได้
  const text = cleanText(value, 200)?.toLowerCase() ?? null;
  return text && /^[0-9a-z._:-]{8,64}$/.test(text) ? text : null;
}

/** วันที่ ISO ที่อยู่ในช่วงสมเหตุสมผล (2000 – อนาคตไม่เกิน 1 วัน) คืนเป็น ISO UTC */
export function cleanIsoDate(value: unknown, now = new Date()): string | null {
  const text = cleanText(value, 40);
  if (!text) return null;
  const time = Date.parse(text);
  if (!Number.isFinite(time) || time < Date.UTC(2000, 0, 1) || time > now.getTime() + 86_400_000) return null;
  return new Date(time).toISOString();
}

function cleanList<T>(value: unknown, limit: number, map: (item: Unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value.slice(0, limit)) {
    if (!isObject(item)) continue;
    const mapped = map(item);
    if (mapped) result.push(mapped);
  }
  return result;
}

const TB = 1024 * 64; // 64 TB เผื่อเซิร์ฟเวอร์

export function cleanAgentHealth(value: unknown, now = new Date()): AgentHealth | null {
  if (!isObject(value)) return null;
  const volumes = cleanList(value.volumes, 26, (item) => {
    const mount = cleanText(item.mount, 120);
    const totalGb = cleanNumber(item.totalGb, 0.01, TB, 2);
    const freeGb = cleanNumber(item.freeGb, 0, TB, 2);
    if (!mount || totalGb === null || freeGb === null || freeGb > totalGb) return null;
    return {
      mount,
      label: cleanText(item.label, 100),
      fileSystem: cleanText(item.fileSystem, 30),
      totalGb,
      freeGb,
      isSystem: cleanBoolean(item.isSystem) === true,
    };
  });
  const memoryTotalMb = cleanNumber(value.memoryTotalMb, 64, 16 * 1024 * 1024);
  let memoryAvailableMb = cleanNumber(value.memoryAvailableMb, 0, 16 * 1024 * 1024);
  if (memoryTotalMb !== null && memoryAvailableMb !== null && memoryAvailableMb > memoryTotalMb) memoryAvailableMb = null;

  const health: AgentHealth = {
    volumes,
    memoryTotalMb,
    memoryAvailableMb,
    cpuLoadPercent: cleanNumber(value.cpuLoadPercent, 0, 100),
    lastBootAt: cleanIsoDate(value.lastBootAt, now),
    physicalDisks: cleanList(value.physicalDisks, 16, (item) => ({
      model: cleanText(item.model, 120),
      mediaType: cleanText(item.mediaType, 30),
      sizeGb: cleanNumber(item.sizeGb, 0, TB),
      healthStatus: cleanText(item.healthStatus, 30),
      predictFailure: cleanBoolean(item.predictFailure),
    })),
    windowsActivation: cleanText(value.windowsActivation, 40),
    antivirus: cleanList(value.antivirus, 8, (item) => {
      const name = cleanText(item.name, 120);
      return name ? { name, enabled: cleanBoolean(item.enabled), upToDate: cleanBoolean(item.upToDate) } : null;
    }),
    lastUpdateInstalledAt: cleanIsoDate(value.lastUpdateInstalledAt, now),
    pendingReboot: cleanBoolean(value.pendingReboot),
    batteryHealthPercent: cleanNumber(value.batteryHealthPercent, 0, 150),
  };
  return health;
}

/** แปลง body ของ /api/agent/report เป็นข้อมูลที่บันทึกได้อย่างปลอดภัย หรือ null ถ้า fingerprint ไม่ถูกต้อง */
export function cleanAgentReport(value: unknown, now = new Date()): CleanAgentReport | null {
  if (!isObject(value)) return null;
  const fingerprint = cleanFingerprint(value.fingerprint);
  if (!fingerprint) return null;

  const health = cleanAgentHealth(value.health, now);
  const diskTotalGb = cleanNumber(value.diskTotalGb, 0, TB);
  let diskFreeGb = cleanNumber(value.diskFreeGb, 0, TB);
  let diskUsedGb = cleanNumber(value.diskUsedGb, 0, TB);
  if (diskTotalGb !== null) {
    if (diskFreeGb !== null && diskFreeGb > diskTotalGb) diskFreeGb = null;
    if (diskUsedGb !== null && diskUsedGb > diskTotalGb) diskUsedGb = null;
  }
  const serialNumber = cleanSerial(value.serialNumber);
  const biosSerial = cleanSerial(value.biosSerial);

  return {
    fingerprint,
    hostname: cleanText(value.hostname, 255),
    serialNumber: serialNumber ?? biosSerial,
    biosSerial,
    deviceType: cleanText(value.deviceType, 100),
    manufacturerBrand: cleanText(value.manufacturerBrand, 255),
    manufacturerModel: cleanText(value.manufacturerModel, 255),
    operatingSystem: cleanText(value.operatingSystem, 255),
    operatingSystemVersion: cleanText(value.operatingSystemVersion, 255),
    privateIp: cleanIpv4(value.privateIp),
    macAddress: cleanMac(value.macAddress),
    currentUser: cleanText(value.currentUser, 255),
    cpuModel: cleanText(value.cpuModel, 255),
    ramMb: cleanNumber(value.ramMb, 64, 16 * 1024 * 1024),
    diskTotalGb,
    diskFreeGb,
    diskUsedGb,
    locationDetail: cleanText(value.locationDetail, 255),
    agentVersion: cleanText(value.agentVersion, 50),
    status: value.status === "offline" ? "offline" : "online",
    health,
  };
}

/** ความสามารถที่ agent ประกาศ (เช่น "self-update" ตั้งแต่ 2.2.0) — ตัวพิมพ์เล็ก ไม่ซ้ำ ไม่เกิน 16 รายการ */
export function cleanAgentCapabilities(value: unknown): string[] {
  const items = Array.isArray(value) ? value.slice(0, 16) : typeof value === "string" ? [value] : [];
  const result = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string") continue;
    const token = item.trim().toLowerCase();
    if (/^[a-z0-9-]{1,32}$/.test(token)) result.add(token);
  }
  return [...result];
}

/** เปรียบเทียบเวอร์ชันแบบ x.y.z (ค่าที่อ่านไม่ได้ถือว่าเก่ากว่า) */
export function compareVersions(a: string | null | undefined, b: string) {
  const parse = (value: string | null | undefined) => (value ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < Math.max(left.length, right.length, 3); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}
