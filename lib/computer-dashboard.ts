import { isItAsset } from "@/lib/asset-policy";
import { isComputerDeviceType } from "@/lib/windows-license";

/**
 * สรุปข้อมูลหน้า "ภาพรวมครุภัณฑ์คอมพิวเตอร์" (/dashboard/it)
 * นับเฉพาะครุภัณฑ์คอมพิวเตอร์ (IT) — ฮาร์ดแวร์ ซอฟต์แวร์ ลิขสิทธิ์ Windows ระบบปฏิบัติการ ประเภทอุปกรณ์ และอายุเครื่อง
 */
export type ComputerDashboardAsset = {
  assetClass?: string;
  assetGroup: "Hardware" | "Software";
  deviceType: string;
  operatingSystem: string;
  manufacturerBrand: string;
  windowsLicenseStatus?: "Genuine" | "Pirated" | null;
  currentStatus: string;
  purchaseDate?: string | null;
  installedAt?: string | null;
};

export type CountRow = { label: string; count: number };

const UNKNOWN = new Set(["", "-", "ไม่ระบุ", "unknown", "n/a"]);
const clean = (value: string | null | undefined) => {
  const text = (value ?? "").trim();
  return UNKNOWN.has(text.toLowerCase()) ? "" : text;
};

/** นับตามค่า เรียงมากไปน้อย ค่าที่เกิน limit รวมเป็น "อื่น ๆ" และค่าว่างเป็น "ไม่ระบุ" */
export function topCounts(values: string[], limit = 6): CountRow[] {
  const counts = new Map<string, number>();
  let blank = 0;
  for (const raw of values) {
    const value = clean(raw);
    if (!value) { blank += 1; continue; }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"));
  const rows: CountRow[] = sorted.slice(0, limit).map(([label, count]) => ({ label, count }));
  const other = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0);
  if (other > 0) rows.push({ label: "อื่น ๆ", count: other });
  if (blank > 0) rows.push({ label: "ไม่ระบุ", count: blank });
  return rows;
}

/** จัดกลุ่ม OS ให้อ่านง่าย: Windows 11 / Windows 10 / Windows 7 / Windows Server / macOS / Linux */
export function osFamily(value: string | null | undefined) {
  const text = clean(value).toLowerCase();
  if (!text) return "";
  if (text.includes("server")) return "Windows Server";
  const win = text.match(/win(?:dows)?\s*(11|10|8\.1|8|7|xp|vista)/);
  if (win) return `Windows ${win[1].toUpperCase() === "XP" ? "XP" : win[1]}`;
  if (text.includes("windows") || /\bwin\b/.test(text)) return "Windows (ไม่ระบุรุ่น)";
  if (text.includes("mac")) return "macOS";
  if (/(linux|ubuntu|debian|centos|rocky|fedora|red ?hat)/.test(text)) return "Linux";
  if (text.includes("android")) return "Android";
  if (text.includes("ios") || text.includes("ipad")) return "iOS/iPadOS";
  return value?.trim() ?? "";
}

export const AGE_BUCKETS = ["ไม่เกิน 3 ปี", "3–5 ปี", "5–7 ปี", "เกิน 7 ปี", "ไม่ระบุวันที่ได้มา"] as const;

export function ageBucket(start: string | null | undefined, today: string) {
  if (!start || !/^\d{4}-\d{2}-\d{2}/.test(start)) return AGE_BUCKETS[4];
  const years = (Date.parse(today) - Date.parse(start.slice(0, 10))) / (365.25 * 86_400_000);
  if (Number.isNaN(years) || years < 0) return AGE_BUCKETS[4];
  if (years <= 3) return AGE_BUCKETS[0];
  if (years <= 5) return AGE_BUCKETS[1];
  if (years <= 7) return AGE_BUCKETS[2];
  return AGE_BUCKETS[3];
}

export function summarizeComputerDashboard(assets: ComputerDashboardAsset[], today = new Date().toISOString().slice(0, 10)) {
  const it = assets.filter((asset) => isItAsset(asset));
  const hardware = it.filter((asset) => asset.assetGroup === "Hardware");
  const software = it.filter((asset) => asset.assetGroup === "Software");
  const computers = hardware.filter((asset) => isComputerDeviceType(asset.deviceType));
  const license = { genuine: 0, nonGenuine: 0, unreported: 0 };
  for (const computer of computers) {
    if (computer.windowsLicenseStatus === "Genuine") license.genuine += 1;
    else if (computer.windowsLicenseStatus === "Pirated") license.nonGenuine += 1;
    else license.unreported += 1;
  }
  const status = { active: 0, inactive: 0, broken: 0 };
  for (const asset of it) {
    if (asset.currentStatus === "Active") status.active += 1;
    else if (asset.currentStatus === "Inactive") status.inactive += 1;
    else if (asset.currentStatus === "Broken") status.broken += 1;
  }
  const ages = new Map<string, number>(AGE_BUCKETS.map((bucket) => [bucket, 0]));
  for (const computer of computers) {
    const bucket = ageBucket(computer.purchaseDate || computer.installedAt, today);
    ages.set(bucket, (ages.get(bucket) ?? 0) + 1);
  }
  return {
    total: it.length,
    hardware: hardware.length,
    software: software.length,
    computers: computers.length,
    license,
    genuineRate: computers.length ? Math.round((license.genuine / computers.length) * 100) : 0,
    status,
    activeRate: it.length ? Math.round((status.active / it.length) * 100) : 0,
    deviceTypes: topCounts(hardware.map((asset) => asset.deviceType), 7),
    softwareTypes: topCounts(software.map((asset) => asset.deviceType), 5),
    operatingSystems: topCounts(computers.map((asset) => osFamily(asset.operatingSystem)), 6),
    brands: topCounts(computers.map((asset) => asset.manufacturerBrand), 6),
    computerAges: AGE_BUCKETS.map((label) => ({ label, count: ages.get(label) ?? 0 })),
    agingComputers: (ages.get(AGE_BUCKETS[3]) ?? 0),
  };
}

export type ComputerDashboardSummary = ReturnType<typeof summarizeComputerDashboard>;
