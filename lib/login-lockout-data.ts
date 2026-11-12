import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { LOGIN_FAILURE_EVENT, LOGIN_SUCCESS_EVENT, loginLockPolicy } from "@/lib/login-throttle";
import { LOGIN_IP_UNLOCK_EVENT, LOGIN_UNLOCK_EVENT, summarizeLockedLogins, type AccountFailures, type IpFailures } from "@/lib/login-lockout";
import { selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

/** บัญชีและ IP ที่ถูกล็อกอยู่ตอนนี้ (นับแบบเดียวกับ checkLoginLock) */
export async function listLockedLogins() {
  const policy = loginLockPolicy();
  try {
    const [clockRows, accountRows, ipRows] = await Promise.all([
      // Compare against the database clock: created_at is written with NOW(), whatever the server time zone is.
      selectRows<RowDataPacket>(`SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS db_now`),
      selectRows<RowDataPacket>(
        `SELECT se.identity_value, se.ip_address, DATE_FORMAT(se.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                u.id AS user_id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS display_name
         FROM security_events se
         LEFT JOIN users u ON u.username = se.identity_value
         WHERE se.event_type = ?
           AND se.created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
           AND se.created_at > COALESCE((
             SELECT MAX(s2.created_at) FROM security_events s2
             WHERE s2.event_type IN (?, ?) AND s2.identity_value = se.identity_value
           ), '1970-01-01')
         ORDER BY se.created_at`,
        [LOGIN_FAILURE_EVENT, policy.windowMinutes, LOGIN_SUCCESS_EVENT, LOGIN_UNLOCK_EVENT]
      ),
      selectRows<RowDataPacket>(
        `SELECT se.ip_address, se.identity_value, DATE_FORMAT(se.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM security_events se
         WHERE se.event_type = ?
           AND se.created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
           AND se.created_at > COALESCE((
             SELECT MAX(s3.created_at) FROM security_events s3
             WHERE s3.event_type = ? AND s3.ip_address = se.ip_address
           ), '1970-01-01')
         ORDER BY se.created_at`,
        [LOGIN_FAILURE_EVENT, policy.windowMinutes, LOGIN_IP_UNLOCK_EVENT]
      ),
    ]);
    const accounts = new Map<string, AccountFailures>();
    for (const row of accountRows) {
      const identity = String(row.identity_value ?? "");
      if (!identity) continue;
      const entry: AccountFailures = accounts.get(identity) ?? { identity, exists: row.user_id != null, displayName: row.display_name || null, failures: [], ips: [] };
      entry.failures.push(String(row.created_at));
      if (row.ip_address && !entry.ips.includes(row.ip_address)) entry.ips.push(String(row.ip_address));
      accounts.set(identity, entry);
    }
    const ips = new Map<string, IpFailures>();
    for (const row of ipRows) {
      const ip = String(row.ip_address);
      const entry: IpFailures = ips.get(ip) ?? { ip, failures: [], identities: [] };
      entry.failures.push(String(row.created_at));
      if (row.identity_value && !entry.identities.includes(row.identity_value)) entry.identities.push(String(row.identity_value));
      ips.set(ip, entry);
    }
    const now = Date.parse(`${String(clockRows[0]?.db_now).replace(" ", "T")}+07:00`);
    return { ...summarizeLockedLogins({ accounts: [...accounts.values()], ips: [...ips.values()] }, policy, now), policy, available: true };
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    return { accounts: [], ips: [], policy, available: false };
  }
}
