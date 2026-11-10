/**
 * System health: the public /api/health/ answer (used by the uptime watchdog and external monitors) and the
 * detailed checks on the admin security dashboard. Pure functions; probes live in lib/system-health-probe.ts.
 */
export type HealthStatus = "ok" | "degraded" | "down";
export type CheckStatus = "ok" | "warning" | "critical";

/** Database answers slower than this are "degraded" (the site still works, but users feel it). */
export const SLOW_DB_MS = 1500;

export function healthResponse({ dbOk, dbMs }: { dbOk: boolean; dbMs: number | null }): { status: HealthStatus; httpStatus: number } {
  if (!dbOk) return { status: "down", httpStatus: 503 };
  if (dbMs !== null && dbMs > SLOW_DB_MS) return { status: "degraded", httpStatus: 200 };
  return { status: "ok", httpStatus: 200 };
}

export type SystemCheck = { key: "db" | "disk" | "memory" | "cron" | "backup"; label: string; status: CheckStatus; detail: string };

export type SystemProbe = {
  db: { ok: boolean; ms: number | null; error?: string };
  disk: { freeBytes: number; totalBytes: number } | null;
  memory: { rssBytes: number; limitBytes: number | null };
  cron: { label: string; health: "ok" | "late" | "failed" | "never" }[];
  backup: { ageHours: number; file: string } | null;
};

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const fmt = (value: number, digits = 1) => value.toLocaleString("th-TH", { maximumFractionDigits: digits });

export function buildSystemChecks(probe: SystemProbe, { backupMaxAgeHours = 36 } = {}): SystemCheck[] {
  const checks: SystemCheck[] = [];

  checks.push(
    !probe.db.ok
      ? { key: "db", label: "ฐานข้อมูล", status: "critical", detail: `เชื่อมต่อไม่ได้${probe.db.error ? ` (${probe.db.error})` : ""}` }
      : {
          key: "db",
          label: "ฐานข้อมูล",
          status: probe.db.ms !== null && probe.db.ms > SLOW_DB_MS ? "warning" : "ok",
          detail: `ตอบกลับใน ${fmt(probe.db.ms ?? 0, 0)} ms`,
        }
  );

  if (!probe.disk || probe.disk.totalBytes <= 0) {
    checks.push({ key: "disk", label: "พื้นที่ดิสก์", status: "warning", detail: "อ่านขนาดดิสก์ไม่ได้" });
  } else {
    const freeRatio = probe.disk.freeBytes / probe.disk.totalBytes;
    checks.push({
      key: "disk",
      label: "พื้นที่ดิสก์",
      status: freeRatio < 0.05 ? "critical" : freeRatio < 0.1 ? "warning" : "ok",
      detail: `ว่าง ${fmt(probe.disk.freeBytes / GB)} จาก ${fmt(probe.disk.totalBytes / GB, 0)} GB (${fmt(freeRatio * 100, 0)}%)`,
    });
  }

  const { rssBytes, limitBytes } = probe.memory;
  const memRatio = limitBytes ? rssBytes / limitBytes : null;
  checks.push({
    key: "memory",
    label: "หน่วยความจำแอป",
    status: memRatio === null ? "ok" : memRatio > 0.95 ? "critical" : memRatio > 0.85 ? "warning" : "ok",
    detail: limitBytes ? `ใช้ ${fmt(rssBytes / MB, 0)} จาก ${fmt(limitBytes / MB, 0)} MB` : `ใช้ ${fmt(rssBytes / MB, 0)} MB`,
  });

  const badCron = probe.cron.filter((job) => job.health !== "ok");
  checks.push({
    key: "cron",
    label: "งานตั้งเวลา (cron)",
    status: probe.cron.length === 0 ? "warning" : badCron.some((job) => job.health === "failed") ? "critical" : badCron.length ? "warning" : "ok",
    detail:
      probe.cron.length === 0
        ? "ยังไม่มีงานรายงานผล"
        : badCron.length
          ? `ต้องตรวจ: ${badCron.map((job) => job.label).join(", ")}`
          : `ทำงานตามรอบครบ ${probe.cron.length} งาน`,
  });

  checks.push(
    !probe.backup
      ? { key: "backup", label: "สำรองฐานข้อมูล", status: "warning", detail: "ไม่พบไฟล์สำรอง หรือยังไม่ได้เชื่อมโฟลเดอร์สำรอง" }
      : {
          key: "backup",
          label: "สำรองฐานข้อมูล",
          status: probe.backup.ageHours > backupMaxAgeHours ? "critical" : "ok",
          detail: `ล่าสุด ${fmt(probe.backup.ageHours)} ชั่วโมงก่อน (${probe.backup.file})`,
        }
  );

  return checks;
}

const RANK: Record<CheckStatus, number> = { ok: 0, warning: 1, critical: 2 };

export function overallStatus(checks: readonly SystemCheck[]): CheckStatus {
  return checks.reduce<CheckStatus>((worst, check) => (RANK[check.status] > RANK[worst] ? check.status : worst), "ok");
}
