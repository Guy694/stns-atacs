import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

/**
 * SEC-08: จำกัดการเดารหัสผ่าน
 *
 * นับจาก security_events ที่มีอยู่แล้ว (ไม่ต้องเพิ่มตารางใหม่) และนับเฉพาะความล้มเหลว
 * ที่เกิด "หลังการเข้าสู่ระบบสำเร็จครั้งล่าสุด" ของบัญชีนั้น เพื่อให้ล็อกอินถูกครั้งเดียวก็ล้างตัวนับ
 *
 * มีสองชั้น:
 *   - ต่อบัญชี  กันการเดารหัสผ่านของผู้ใช้คนหนึ่ง (ล็อกสั้น ๆ ไม่ปิดบัญชีถาวร)
 *   - ต่อ IP    กันการไล่เดาหลายบัญชีจากที่เดียว (เพดานสูงกว่า เพราะสำนักงานหนึ่งใช้ IP ร่วมกัน)
 */
export const LOGIN_FAILURE_EVENT = "login_failed_password";
export const LOGIN_SUCCESS_EVENT = "login_succeeded";

export type LoginLockPolicy = {
  windowMinutes: number;
  maxPerAccount: number;
  maxPerIp: number;
};

export type LoginLock = { locked: boolean; scope: "account" | "ip" | null; retryAfterMinutes: number };

export function loginLockPolicy(env: NodeJS.ProcessEnv = process.env): LoginLockPolicy {
  const read = (name: string, fallback: number, min: number) => {
    const value = Number(env[name]);
    return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
  };
  return {
    windowMinutes: read("LOGIN_LOCK_WINDOW_MINUTES", 15, 1),
    maxPerAccount: read("LOGIN_MAX_FAILURES_PER_ACCOUNT", 5, 3),
    maxPerIp: read("LOGIN_MAX_FAILURES_PER_IP", 20, 5),
  };
}

/** ตรรกะล้วน แยกจากฐานข้อมูลเพื่อให้ทดสอบได้ */
export function evaluateLoginLock(
  counts: { account: number; ip: number },
  policy: LoginLockPolicy
): LoginLock {
  if (counts.account >= policy.maxPerAccount) {
    return { locked: true, scope: "account", retryAfterMinutes: policy.windowMinutes };
  }
  if (counts.ip >= policy.maxPerIp) {
    return { locked: true, scope: "ip", retryAfterMinutes: policy.windowMinutes };
  }
  return { locked: false, scope: null, retryAfterMinutes: 0 };
}

export function loginLockMessage(lock: LoginLock) {
  if (!lock.locked) return null;
  return lock.scope === "account"
    ? `บัญชีนี้ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณารออีก ${lock.retryAfterMinutes} นาทีแล้วลองใหม่ หรือติดต่อผู้ดูแลระบบ`
    : `มีการพยายามเข้าสู่ระบบผิดพลาดจำนวนมากจากเครือข่ายนี้ กรุณารออีก ${lock.retryAfterMinutes} นาทีแล้วลองใหม่`;
}

type CountRow = RowDataPacket & { total: number };

/**
 * นับความล้มเหลวในหน้าต่างเวลา
 * ระบบจะไม่ล็อกใครเลยถ้ายังไม่มีตาราง security_events (ยังไม่ได้รัน add_security_events.sql)
 */
export async function countRecentLoginFailures(username: string, ipAddress: string, policy: LoginLockPolicy) {
  try {
    const [accountRows, ipRows] = await Promise.all([
      selectRows<CountRow>(
        `SELECT COUNT(*) AS total
         FROM security_events
         WHERE event_type = ?
           AND identity_value = ?
           AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
           AND created_at > COALESCE((
             SELECT MAX(created_at) FROM security_events s2
             WHERE s2.event_type = ? AND s2.identity_value = ?
           ), '1970-01-01')`,
        [LOGIN_FAILURE_EVENT, username, policy.windowMinutes, LOGIN_SUCCESS_EVENT, username]
      ),
      selectRows<CountRow>(
        `SELECT COUNT(*) AS total
         FROM security_events
         WHERE event_type = ?
           AND ip_address = ?
           AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [LOGIN_FAILURE_EVENT, ipAddress, policy.windowMinutes]
      ),
    ]);
    return { account: Number(accountRows[0]?.total ?? 0), ip: Number(ipRows[0]?.total ?? 0), available: true };
  } catch (error) {
    if (isMissingSchemaError(error)) return { account: 0, ip: 0, available: false };
    throw error;
  }
}

/** ตรวจว่าล็อกอินครั้งนี้ควรถูกปฏิเสธก่อนตรวจรหัสผ่านหรือไม่ */
export async function checkLoginLock(username: string, ipAddress: string): Promise<LoginLock> {
  const policy = loginLockPolicy();
  const counts = await countRecentLoginFailures(username, ipAddress, policy);
  if (!counts.available) return { locked: false, scope: null, retryAfterMinutes: 0 };
  return evaluateLoginLock(counts, policy);
}
