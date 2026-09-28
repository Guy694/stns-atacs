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
  /** เหตุการณ์ปกติ (เช่น เข้าสู่ระบบสำเร็จ) ที่บันทึกไว้เพื่ออ้างอิง ไม่ต้องแจ้งเตือนเมื่อเกิดถี่ */
  skipBurstAlert?: boolean;
};

type CountRow = RowDataPacket & {
  total: number;
};

function normalizeIp(value?: string | null) {
  return value?.split(",")[0]?.trim().slice(0, 45) || "unknown";
}

/**
 * SEC-08: อ่าน IP ของผู้ใช้จริงจาก X-Forwarded-For อย่างปลอดภัย
 *
 * X-Forwarded-For เป็นรายการที่ proxy แต่ละชั้น "ต่อท้าย" IP ที่ตัวเองเห็น
 * ดังนั้นรายการท้าย ๆ มาจาก proxy ที่เราเชื่อถือ ส่วนรายการแรก ๆ ไคลเอนต์ปลอมได้
 * จึงนับถอยหลังจากท้ายตามจำนวนชั้น proxy ที่ตั้งค่าไว้ (TRUSTED_PROXY_COUNT)
 *
 *   TRUSTED_PROXY_COUNT=2  (เช่น Caddy/Nginx ของเซิร์ฟเวอร์ + proxy ของโดเมนอีกชั้น)
 *   ไม่ตั้งค่า / 0          = ไม่เชื่อค่าที่ไคลเอนต์ส่งมาเลย ใช้ IP ของ hop ที่ใกล้ที่สุด
 *                            (ปลอมไม่ได้ แต่ถ้ามี proxy จะได้ IP ของ proxy แทนผู้ใช้จริง)
 */
type ProxyEnv = { TRUSTED_PROXY_COUNT?: string };

export function readRequestIp(headers: Headers, env: ProxyEnv = process.env as ProxyEnv) {
  const forwarded = headers.get("x-forwarded-for");
  const parts = (forwarded ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return normalizeIp(headers.get("x-real-ip"));

  const configured = Number(env.TRUSTED_PROXY_COUNT ?? 0);
  const trusted = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 0;
  if (trusted === 0) return normalizeIp(parts[parts.length - 1]);

  // นับถอยหลัง: ชั้นที่เชื่อถือได้เป็นรายการท้ายสุด ผู้ใช้จริงอยู่ก่อนหน้านั้น
  const index = Math.max(0, parts.length - trusted);
  return normalizeIp(parts[index]);
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

    if (total >= threshold && !input.skipBurstAlert) {
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
