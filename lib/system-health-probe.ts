import "server-only";

import fs from "node:fs/promises";

import { readBackupDir } from "@/lib/backup-dir";
import { evaluateBackupHealth } from "@/lib/backup-status";
import { listCronStatus } from "@/lib/cron-status";
import { selectRows } from "@/lib/mysql";
import type { SystemProbe } from "@/lib/system-health";

const DB_TIMEOUT_MS = 5000;

export async function probeDatabase(): Promise<SystemProbe["db"]> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      selectRows("SELECT 1 AS ok"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), DB_TIMEOUT_MS);
      }),
    ]);
    return { ok: true, ms: Math.round(performance.now() - started) };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return { ok: false, ms: null, error: code === "TIMEOUT" ? `ไม่ตอบภายใน ${DB_TIMEOUT_MS / 1000} วินาที` : code ?? "เชื่อมต่อไม่ได้" };
  } finally {
    clearTimeout(timer);
  }
}

async function diskUsage(dir: string): Promise<SystemProbe["disk"]> {
  try {
    const stats = await fs.statfs(/*turbopackIgnore: true*/ dir);
    return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
  } catch {
    return null;
  }
}

/** Container memory limit (cgroup v2, then v1). null = unlimited or not in a container. */
async function memoryLimitBytes(): Promise<number | null> {
  for (const file of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    try {
      const raw = (await fs.readFile(/*turbopackIgnore: true*/ file, "utf8")).trim();
      const value = Number(raw);
      if (raw === "max" || !Number.isFinite(value) || value <= 0 || value > 2 ** 50) return null;
      return value;
    } catch {
      // try the next layout
    }
  }
  return null;
}

/** Everything the admin "สถานะระบบ" panel needs, gathered in parallel. Never throws. */
export async function probeSystem(now = new Date()): Promise<SystemProbe & { uptimeSeconds: number }> {
  const [db, disk, limitBytes, cron, backupDir] = await Promise.all([
    probeDatabase(),
    diskUsage(process.env.UPLOAD_DIR?.trim() || process.cwd()),
    memoryLimitBytes(),
    listCronStatus(now).catch(() => []),
    readBackupDir().catch(() => ({ files: [], status: null, error: "error" })),
  ]);
  const backupHealth = backupDir.error ? null : evaluateBackupHealth({ files: backupDir.files, status: backupDir.status, now: now.getTime() });
  return {
    db,
    disk,
    memory: { rssBytes: process.memoryUsage().rss, limitBytes },
    cron: cron.map((job) => ({ label: job.label, health: job.health })),
    backup:
      backupHealth?.latestDatabaseFile && backupHealth.latestDatabaseAgeHours !== null
        ? { ageHours: backupHealth.latestDatabaseAgeHours, file: backupHealth.latestDatabaseFile }
        : null,
    uptimeSeconds: Math.round(process.uptime()),
  };
}
