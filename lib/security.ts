import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";
import { notifyTelegramSafe } from "@/lib/telegram";

type SecurityEventInput = {
  eventType: string;
  ipAddress?: string | null;
  identity?: string | null;
  path?: string | null;
  detail?: string | null;
};

type CountRow = RowDataPacket & {
  total: number;
};

function normalizeIp(value?: string | null) {
  return value?.split(",")[0]?.trim().slice(0, 45) || "unknown";
}

export function readRequestIp(headers: Headers) {
  return normalizeIp(headers.get("x-forwarded-for") ?? headers.get("x-real-ip"));
}

export async function recordSecurityEvent(input: SecurityEventInput) {
  const ipAddress = normalizeIp(input.ipAddress);
  const configuredWindow = Number(process.env.SECURITY_ALERT_WINDOW_MINUTES ?? 10);
  const configuredThreshold = Number(process.env.SECURITY_ALERT_THRESHOLD ?? 5);
  const windowMinutes = Number.isFinite(configuredWindow) ? Math.max(1, Math.floor(configuredWindow)) : 10;
  const threshold = Number.isFinite(configuredThreshold) ? Math.max(2, Math.floor(configuredThreshold)) : 5;
  const eventType = input.eventType.slice(0, 100);

  try {
    await executeStatement(
      `INSERT INTO security_events (event_type, ip_address, identity_value, request_path, detail)
       VALUES (?, ?, ?, ?, ?)`,
      [
        eventType,
        ipAddress,
        input.identity?.slice(0, 255) || null,
        input.path?.slice(0, 255) || null,
        input.detail?.slice(0, 1000) || null,
      ]
    );

    const rows = await selectRows<CountRow>(
      `SELECT COUNT(*) AS total
       FROM security_events
       WHERE event_type = ?
         AND ip_address = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [eventType, ipAddress, windowMinutes]
    );
    const total = Number(rows[0]?.total ?? 0);

    if (total >= threshold) {
      const bucket = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
      await notifyTelegramSafe({
        category: "security",
        title: "ตรวจพบพฤติกรรมผิดปกติซ้ำจาก IP เดียวกัน",
        eventKey: `security-burst:${eventType}:${ipAddress}:${bucket}`,
        details: {
          เหตุการณ์: eventType,
          IP: ipAddress,
          จำนวนครั้ง: `${total} ครั้ง ภายใน ${windowMinutes} นาที`,
          บัญชีหรือข้อมูลอ้างอิง: input.identity,
          เส้นทาง: input.path,
          รายละเอียดล่าสุด: input.detail,
        },
      });
    }

    return { recorded: true, total, suspicious: total >= threshold };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.error(`Security event recording failed (${reason})`);
    return { recorded: false, total: 0, suspicious: false };
  }
}
