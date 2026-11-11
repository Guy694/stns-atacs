import "server-only";

import crypto from "node:crypto";

import type { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";

import { executeStatement, selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";

const SESSION_COOKIE_NAME = "atacs_session";
const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_DAYS ?? 7);

export type ActiveSession = {
  id: number;
  userId: number;
  userName: string;
  username: string | null;
  role: string;
  facilityName: string | null;
  ip: string | null;
  lastIp: string | null;
  userAgent: string | null;
  loginMethod: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
};

export async function currentSessionHash() {
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return raw ? crypto.createHash("sha256").update(raw).digest("hex") : null;
}

/** Sessions that can still be used (not expired by idle time or by the absolute lifetime). */
export async function listActiveSessions(filter: { userId?: number } = {}): Promise<{ sessions: ActiveSession[]; tracked: boolean }> {
  const current = await currentSessionHash();
  const where = ["s.expires_at > NOW()", "s.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)", "u.is_active = 1"];
  const values: unknown[] = [SESSION_TTL_DAYS];
  if (filter.userId) {
    where.push("s.user_id = ?");
    values.push(filter.userId);
  }
  const query = (columns: string) =>
    selectRows<RowDataPacket>(
      `SELECT s.id, s.user_id, s.session_token_hash, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS user_name, u.username, u.role,
              hf.name AS facility_name, ${columns},
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(s.expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN health_facilities hf ON hf.id = u.facility_id
       WHERE ${where.join(" AND ")}
       ORDER BY COALESCE(s.last_seen_at, s.created_at) DESC
       LIMIT 500`,
      values
    );
  let rows: RowDataPacket[];
  let tracked = true;
  try {
    rows = await query("s.ip_address, s.last_ip, s.user_agent, s.login_method, DATE_FORMAT(s.last_seen_at, '%Y-%m-%d %H:%i:%s') AS last_seen_at");
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    tracked = false;
    rows = await query("NULL AS ip_address, NULL AS last_ip, NULL AS user_agent, NULL AS login_method, NULL AS last_seen_at");
  }
  return {
    tracked,
    sessions: rows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      userName: String(row.user_name ?? ""),
      username: row.username ?? null,
      role: String(row.role),
      facilityName: row.facility_name ?? null,
      ip: row.ip_address ?? null,
      lastIp: row.last_ip ?? null,
      userAgent: row.user_agent ?? null,
      loginMethod: row.login_method ?? null,
      createdAt: String(row.created_at),
      lastSeenAt: row.last_seen_at ?? null,
      expiresAt: String(row.expires_at),
      isCurrent: Boolean(current) && row.session_token_hash === current,
    })),
  };
}

export async function getSessionOwner(sessionId: number) {
  const rows = await selectRows<RowDataPacket>(
    `SELECT s.id, s.user_id, s.session_token_hash, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS user_name
     FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? LIMIT 1`,
    [sessionId]
  );
  const row = rows[0];
  return row ? { id: Number(row.id), userId: Number(row.user_id), userName: String(row.user_name), tokenHash: String(row.session_token_hash) } : null;
}

export async function deleteSession(sessionId: number) {
  const result = await executeStatement(`DELETE FROM auth_sessions WHERE id = ?`, [sessionId]);
  return Number(result.affectedRows ?? 0);
}

/** Every session of a user except (optionally) one token hash. */
export async function deleteUserSessions(userId: number, exceptHash: string | null) {
  const result = exceptHash
    ? await executeStatement(`DELETE FROM auth_sessions WHERE user_id = ? AND session_token_hash <> ?`, [userId, exceptHash])
    : await executeStatement(`DELETE FROM auth_sessions WHERE user_id = ?`, [userId]);
  return Number(result.affectedRows ?? 0);
}
