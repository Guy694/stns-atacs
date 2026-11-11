import "server-only";

import type { RowDataPacket } from "mysql2";

import { dbDateTime } from "@/lib/local-date";
import { selectRows } from "@/lib/mysql";
import { eventTypesForGroup, SUSPICIOUS_EVENT_TYPES, type DailyCountRow, type TypeCountRow } from "@/lib/security-dashboard";

/** Bangkok calendar day computed from the epoch, so it is right whatever the MySQL session time zone is. */
const BKK_DAY_NUMBER = "FLOOR((UNIX_TIMESTAMP(created_at) + 25200) / 86400)";
const dayFromNumber = (value: number) => new Date(Number(value) * 86400000).toISOString().slice(0, 10);

export async function countEventsByType(hours: number): Promise<TypeCountRow[]> {
  const rows = await selectRows<RowDataPacket & { event_type: string; total: number; ips: number }>(
    `SELECT event_type, COUNT(*) AS total, COUNT(DISTINCT ip_address) AS ips
     FROM security_events
     WHERE created_at >= NOW() - INTERVAL ? HOUR
     GROUP BY event_type
     ORDER BY total DESC`,
    [hours]
  );
  return rows.map((row) => ({ eventType: row.event_type, total: Number(row.total), ips: Number(row.ips) }));
}

export async function dailyEventCounts(days: number): Promise<DailyCountRow[]> {
  const rows = await selectRows<RowDataPacket & { day_number: number; event_type: string; total: number }>(
    `SELECT ${BKK_DAY_NUMBER} AS day_number, event_type, COUNT(*) AS total
     FROM security_events
     WHERE created_at >= NOW() - INTERVAL ? DAY
     GROUP BY day_number, event_type`,
    [days + 1]
  );
  return rows.map((row) => ({ day: dayFromNumber(row.day_number), eventType: row.event_type, total: Number(row.total) }));
}

export type SuspiciousIp = {
  ip: string;
  total: number;
  kinds: string[];
  identities: string[];
  firstSeen: string;
  lastSeen: string;
  /** The same IP also signed in successfully in the window — worth a look after many failures. */
  succeeded: number;
};

export async function topSuspiciousIps(days: number, limit = 10): Promise<SuspiciousIp[]> {
  const rows = await selectRows<
    RowDataPacket & { ip_address: string; total: number; kinds: string | null; identities: string | null; first_seen: Date | string; last_seen: Date | string; succeeded: number }
  >(
    `SELECT s.ip_address, COUNT(*) AS total,
            GROUP_CONCAT(DISTINCT s.event_type ORDER BY s.event_type SEPARATOR ',') AS kinds,
            SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT s.identity_value ORDER BY s.identity_value SEPARATOR '\\n'), '\\n', 5) AS identities,
            MIN(s.created_at) AS first_seen, MAX(s.created_at) AS last_seen,
            (SELECT COUNT(*) FROM security_events ok
              WHERE ok.event_type = 'login_succeeded' AND ok.ip_address = s.ip_address
                AND ok.created_at >= NOW() - INTERVAL ? DAY) AS succeeded
     FROM security_events s
     WHERE s.created_at >= NOW() - INTERVAL ? DAY AND s.event_type IN (?)
     GROUP BY s.ip_address
     ORDER BY total DESC, last_seen DESC
     LIMIT ?`,
    [days, days, SUSPICIOUS_EVENT_TYPES, limit]
  );
  return rows.map((row) => ({
    ip: row.ip_address,
    total: Number(row.total),
    kinds: (row.kinds ?? "").split(",").filter(Boolean),
    identities: (row.identities ?? "").split("\n").filter(Boolean),
    firstSeen: dbDateTime(row.first_seen),
    lastSeen: dbDateTime(row.last_seen),
    succeeded: Number(row.succeeded),
  }));
}

export type SecurityEventFilter = { days: number; group?: string; type?: string; ip?: string; search?: string };

export type SecurityEventRow = {
  id: number;
  eventType: string;
  ip: string;
  identity: string | null;
  path: string | null;
  detail: string | null;
  createdAt: string;
};

function whereFor(filter: SecurityEventFilter) {
  const clauses = ["created_at >= NOW() - INTERVAL ? DAY"];
  const values: unknown[] = [filter.days];
  if (filter.type) {
    clauses.push("event_type = ?");
    values.push(filter.type);
  } else if (filter.group) {
    const types = eventTypesForGroup(filter.group);
    if (filter.group !== "other" && types.length) {
      clauses.push("event_type IN (?)");
      values.push(types);
    }
  }
  if (filter.ip) {
    clauses.push("ip_address = ?");
    values.push(filter.ip);
  }
  if (filter.search) {
    clauses.push("(identity_value LIKE ? OR detail LIKE ? OR request_path LIKE ? OR ip_address LIKE ?)");
    const like = `%${filter.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    values.push(like, like, like, like);
  }
  return { sql: clauses.join(" AND "), values };
}

const toEvent = (row: RowDataPacket): SecurityEventRow => ({
  id: Number(row.id),
  eventType: String(row.event_type),
  ip: String(row.ip_address),
  identity: row.identity_value ?? null,
  path: row.request_path ?? null,
  detail: row.detail ?? null,
  createdAt: dbDateTime(row.created_at),
});

export async function listSecurityEvents(filter: SecurityEventFilter, page: number, pageSize = 50) {
  const { sql, values } = whereFor(filter);
  const [{ total }] = await selectRows<RowDataPacket & { total: number }>(`SELECT COUNT(*) AS total FROM security_events WHERE ${sql}`, values);
  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const rows = await selectRows<RowDataPacket>(
    `SELECT id, event_type, ip_address, identity_value, request_path, detail, created_at
     FROM security_events WHERE ${sql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, (current - 1) * pageSize]
  );
  return { rows: rows.map(toEvent), total: Number(total), page: current, totalPages, pageSize };
}

export const SECURITY_EXPORT_LIMIT = 20000;

export async function exportSecurityEvents(filter: SecurityEventFilter) {
  const { sql, values } = whereFor(filter);
  const rows = await selectRows<RowDataPacket>(
    `SELECT id, event_type, ip_address, identity_value, request_path, detail, created_at
     FROM security_events WHERE ${sql}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [...values, SECURITY_EXPORT_LIMIT]
  );
  return rows.map(toEvent);
}

/** Raw agent_unknown_id events (90 days) for lib/agent-auth-failure summarizeUnknownAgents. */
export async function listUnknownAgentEvents(days = 90) {
  const rows = await selectRows<RowDataPacket>(
    `SELECT identity_value, ip_address, detail, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM security_events
     WHERE event_type = 'agent_unknown_id' AND created_at >= NOW() - INTERVAL ? DAY
     ORDER BY created_at DESC LIMIT 2000`,
    [days]
  );
  return rows.map((row) => ({ identity: row.identity_value ?? null, ip: String(row.ip_address), detail: row.detail ?? null, createdAt: String(row.created_at) }));
}
