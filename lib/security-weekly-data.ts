import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { listAgentDevices } from "@/lib/agent";
import { findStaleAgents, staleAgentDays } from "@/lib/agent-stale";
import { backupCheckDir, readBackupDir } from "@/lib/backup-dir";
import { evaluateBackupHealth } from "@/lib/backup-status";
import { selectRows } from "@/lib/mysql";
import type { WeeklySecurityData } from "@/lib/security-weekly";
import { countryName, locationLabel } from "@/lib/visitor-log";
import { geoForIps } from "@/lib/visitor-log-data";

/** เหตุการณ์ที่นับเป็น "IP ที่น่าสงสัย" (เหมือน topSuspiciousIps ในหน้าความปลอดภัย) */
const SUSPICIOUS = ["login_failed_password", "login_locked_out", "agent_invalid_credentials", "cron_unauthorized", "login_invalid_input"];
/** การเปลี่ยนแปลงด้านความปลอดภัยที่ผู้ดูแลทำ */
const CHANGES = ["auth_setting_changed", "session_revoked", "login_unlocked", "login_ip_unlocked", "agent_retired", "agent_uninstall_requested"];

const ph = (list: readonly string[]) => list.map(() => "?").join(", ");
const safe = async <T,>(promise: Promise<T>, fallback: T) => promise.catch((error) => (console.error("[security-weekly]", error instanceof Error ? error.message : error), fallback));

/** `start`..`end` = วันที่ไทย (รวมทั้งสองวัน) · created_at เก็บเป็นเวลาไทยบน production (+07:00) */
export async function collectWeeklySecurity(start: string, end: string): Promise<WeeklySecurityData> {
  const from = `${start} 00:00:00`;
  const to = `${end} 23:59:59`;

  const [eventRows, ipRows, visitorRows, foreignRows, devices, backup] = await Promise.all([
    safe(
      selectRows<RowDataPacket>(
        `SELECT event_type, COUNT(*) AS total, COUNT(DISTINCT identity_value) AS identities, COUNT(DISTINCT ip_address) AS ips
         FROM security_events WHERE created_at BETWEEN ? AND ? GROUP BY event_type`,
        [from, to]
      ),
      []
    ),
    safe(
      selectRows<RowDataPacket>(
        `SELECT ip_address, COUNT(*) AS total FROM security_events
         WHERE created_at BETWEEN ? AND ? AND event_type IN (${ph(SUSPICIOUS)})
         GROUP BY ip_address ORDER BY total DESC LIMIT 3`,
        [from, to, ...SUSPICIOUS]
      ),
      []
    ),
    safe(
      selectRows<RowDataPacket>(
        `SELECT COUNT(*) AS visits, COUNT(DISTINCT ip_address) AS ips FROM visitor_access_log WHERE visited_at BETWEEN ? AND ? AND is_bot = 0`,
        [from, to]
      ),
      []
    ),
    safe(
      selectRows<RowDataPacket>(
        `SELECT g.country, COUNT(DISTINCT g.ip_address) AS ips
         FROM ip_geo_cache g
         WHERE g.network = 'public' AND g.country IS NOT NULL AND g.country <> 'TH'
           AND (g.ip_address IN (SELECT ip_address FROM visitor_access_log WHERE visited_at BETWEEN ? AND ?)
             OR g.ip_address IN (SELECT ip_address FROM security_events WHERE created_at BETWEEN ? AND ?))
         GROUP BY g.country ORDER BY ips DESC`,
        [from, to, from, to]
      ),
      []
    ),
    safe(listAgentDevices(), []),
    safe(readBackupDir(backupCheckDir()), { files: [], status: null, error: "อ่านโฟลเดอร์สำรองไม่ได้" }),
  ]);

  const event = (type: string) => eventRows.find((row) => row.event_type === type);
  const count = (type: string) => Number(event(type)?.total ?? 0);
  const geo = await safe(geoForIps(ipRows.map((row) => String(row.ip_address))), new Map());

  const health = backup.error
    ? null
    : evaluateBackupHealth({ files: backup.files, status: backup.status, maxAgeHours: Number(process.env.BACKUP_MAX_AGE_HOURS ?? 36) || 36 });
  const backupLabel = !health
    ? String(backup.error)
    : health.level === "ok"
      ? `ไฟล์ล่าสุด ${health.latestDatabaseAgeHours ?? "-"} ชม. ที่แล้ว${health.latestDatabaseBytes ? ` (${(health.latestDatabaseBytes / 1024 / 1024).toFixed(1)} MB)` : ""}`
      : health.problems.join(" · ");

  const staleDays = staleAgentDays(process.env);
  return {
    period: { start, end },
    logins: {
      succeeded: count("login_succeeded"),
      users: Number(event("login_succeeded")?.identities ?? 0),
      failed: count("login_failed_password"),
      failedIps: Number(event("login_failed_password")?.ips ?? 0),
      lockouts: count("login_lock_triggered"),
    },
    topIps: ipRows.map((row) => ({ ip: String(row.ip_address), total: Number(row.total), location: geo.has(String(row.ip_address)) ? locationLabel(geo.get(String(row.ip_address))!) : null })),
    foreign: {
      ips: foreignRows.reduce((sum, row) => sum + Number(row.ips), 0),
      countries: foreignRows.map((row) => countryName(row.country) ?? String(row.country)),
    },
    agents: {
      wrongKey: count("agent_invalid_credentials"),
      unknown: count("agent_unknown_id"),
      staleDevices: findStaleAgents(devices, Date.now(), staleDays).length,
      staleDays,
    },
    changes: CHANGES.reduce((sum, type) => sum + count(type), 0),
    visitors: { visits: Number(visitorRows[0]?.visits ?? 0), ips: Number(visitorRows[0]?.ips ?? 0) },
    backup: { ok: health?.level === "ok", label: backupLabel },
  };
}
