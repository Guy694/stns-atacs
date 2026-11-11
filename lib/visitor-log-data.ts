import "server-only";

import type { RowDataPacket } from "mysql2";

import { executeStatement, selectRows } from "@/lib/mysql";
import { classifyIp, geoLookupUrl, parseGeoLookup, visitorLogRetentionDays, type IpGeo } from "@/lib/visitor-log";

export type IpGeoRow = {
  ip: string;
  network: string;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  source: string | null;
};

/** Re-look-up a public IP after this many days (addresses get reassigned). Failed lookups retry after a day. */
const GEO_TTL_DAYS = 30;
const FAILED_RETRY_HOURS = 24;
const LOOKUP_TIMEOUT_MS = 3000;
const inFlight = new Map<string, Promise<void>>();

async function saveGeo(ip: string, network: string, geo: IpGeo | null, source: string) {
  await executeStatement(
    `INSERT INTO ip_geo_cache (ip_address, network, country, region, city, latitude, longitude, isp, source, looked_up_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE network = VALUES(network), country = VALUES(country), region = VALUES(region), city = VALUES(city),
       latitude = VALUES(latitude), longitude = VALUES(longitude), isp = VALUES(isp), source = VALUES(source), looked_up_at = NOW()`,
    [ip, network, geo?.country ?? null, geo?.region ?? null, geo?.city ?? null, geo?.latitude ?? null, geo?.longitude ?? null, geo?.isp ?? null, source]
  );
}

async function needsLookup(ip: string) {
  const rows = await selectRows<RowDataPacket & { source: string | null; age_hours: number }>(
    `SELECT source, TIMESTAMPDIFF(HOUR, looked_up_at, NOW()) AS age_hours FROM ip_geo_cache WHERE ip_address = ? LIMIT 1`,
    [ip]
  );
  const row = rows[0];
  if (!row) return true;
  if (row.source === "failed" || row.source === "disabled") return Number(row.age_hours) >= FAILED_RETRY_HOURS;
  return Number(row.age_hours) >= GEO_TTL_DAYS * 24;
}

/**
 * Makes sure ip_geo_cache knows this IP. Internal addresses are stored without any lookup; public ones go to
 * VISITOR_GEO_LOOKUP_URL (if set) at most once per IP per TTL. Never throws, never blocks a page for long.
 */
export async function ensureIpGeo(ip: string, headerGeo: IpGeo | null = null): Promise<void> {
  const key = ip.trim();
  if (!key || key.length > 45) return;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      if (!(await needsLookup(key))) return;
      const network = classifyIp(key);
      if (network !== "public") return void (await saveGeo(key, network, null, network === "private" ? "private" : "failed"));
      if (headerGeo) return void (await saveGeo(key, network, headerGeo, "headers"));
      const url = geoLookupUrl(key);
      if (!url) return void (await saveGeo(key, network, null, "disabled"));
      let geo: IpGeo | null = null;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), headers: { accept: "application/json" } });
        if (response.ok) geo = parseGeoLookup(await response.json());
      } catch {
        geo = null;
      }
      await saveGeo(key, network, geo, geo ? "lookup" : "failed");
    } catch (error) {
      console.error("[ip-geo] could not resolve", error instanceof Error ? error.message : error);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

/** Resolves up to `limit` IPs in the background (dashboards call this; results appear on the next load). */
export function ensureIpGeoInBackground(ips: readonly string[], limit = 20) {
  const unique = [...new Set(ips.filter(Boolean))].slice(0, limit);
  void (async () => {
    for (const ip of unique) await ensureIpGeo(ip);
  })();
}

export async function geoForIps(ips: readonly string[]): Promise<Map<string, IpGeoRow>> {
  const unique = [...new Set(ips.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await selectRows<RowDataPacket>(
    `SELECT ip_address, network, country, region, city, latitude, longitude, isp, source FROM ip_geo_cache WHERE ip_address IN (?)`,
    [unique]
  ).catch(() => [] as RowDataPacket[]);
  return new Map(
    rows.map((row) => [
      String(row.ip_address),
      {
        ip: String(row.ip_address),
        network: String(row.network),
        country: row.country ?? null,
        region: row.region ?? null,
        city: row.city ?? null,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        isp: row.isp ?? null,
        source: row.source ?? null,
      },
    ])
  );
}

export type VisitInput = {
  ip: string;
  area: "public" | "staff";
  path: string;
  referrerHost: string | null;
  user: { id: number; fullName: string; role: string } | null;
  device: string;
  browser: string;
  bot: boolean;
  userAgent: string;
};

export async function recordVisit(visit: VisitInput) {
  await executeStatement(
    `INSERT INTO visitor_access_log (ip_address, area, path, referrer_host, user_id, user_name, role, device, browser, is_bot, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visit.ip.slice(0, 45),
      visit.area,
      visit.path,
      visit.referrerHost,
      visit.user?.id ?? null,
      visit.user?.fullName?.slice(0, 255) ?? null,
      visit.user?.role ?? null,
      visit.device,
      visit.browser,
      visit.bot ? 1 : 0,
      visit.userAgent.slice(0, 300),
    ]
  );
}

/** Daily cleanup (cron daily-summary): visits older than the retention window, stale geo rows. */
export async function purgeOldVisitorData() {
  const days = visitorLogRetentionDays();
  const visits = await executeStatement(`DELETE FROM visitor_access_log WHERE visited_at < NOW() - INTERVAL ? DAY`, [days]);
  const geo = await executeStatement(`DELETE FROM ip_geo_cache WHERE looked_up_at < NOW() - INTERVAL ? DAY`, [days * 2]);
  return { days, visits: visits.affectedRows, geo: geo.affectedRows };
}

// ---------------------------------------------------------------- dashboard queries

export type VisitorFilter = { days: number; area?: "public" | "staff"; ip?: string; loggedIn?: boolean; search?: string; includeBots?: boolean };

function whereFor(filter: VisitorFilter, alias = "v") {
  const clauses = [`${alias}.visited_at >= NOW() - INTERVAL ? DAY`];
  const values: unknown[] = [filter.days];
  if (!filter.includeBots) clauses.push(`${alias}.is_bot = 0`);
  if (filter.area) {
    clauses.push(`${alias}.area = ?`);
    values.push(filter.area);
  }
  if (filter.ip) {
    clauses.push(`${alias}.ip_address = ?`);
    values.push(filter.ip);
  }
  if (filter.loggedIn) clauses.push(`${alias}.user_id IS NOT NULL`);
  if (filter.search) {
    const like = `%${filter.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    clauses.push(`(${alias}.ip_address LIKE ? OR ${alias}.path LIKE ? OR ${alias}.user_name LIKE ? OR g.city LIKE ? OR g.region LIKE ? OR g.isp LIKE ?)`);
    values.push(like, like, like, like, like, like);
  }
  return { sql: clauses.join(" AND "), values };
}

const FROM = "FROM visitor_access_log v LEFT JOIN ip_geo_cache g ON g.ip_address = v.ip_address";

export async function visitorKpis(filter: VisitorFilter) {
  const { sql, values } = whereFor(filter);
  const [row] = await selectRows<RowDataPacket>(
    `SELECT COUNT(*) AS visits, COUNT(DISTINCT v.ip_address) AS ips, COUNT(DISTINCT v.user_id) AS users,
            SUM(v.area = 'public') AS public_visits, SUM(v.area = 'staff') AS staff_visits,
            COUNT(DISTINCT CASE WHEN g.network = 'private' THEN v.ip_address END) AS private_ips,
            COUNT(DISTINCT CASE WHEN g.network = 'public' AND g.country IS NOT NULL AND g.country <> 'TH' THEN v.ip_address END) AS foreign_ips
     ${FROM} WHERE ${sql}`,
    values
  );
  return {
    visits: Number(row?.visits ?? 0),
    ips: Number(row?.ips ?? 0),
    users: Number(row?.users ?? 0),
    publicVisits: Number(row?.public_visits ?? 0),
    staffVisits: Number(row?.staff_visits ?? 0),
    privateIps: Number(row?.private_ips ?? 0),
    foreignIps: Number(row?.foreign_ips ?? 0),
  };
}

export type LocationCount = { network: string | null; country: string | null; region: string | null; visits: number; ips: number; users: number };

/** Visits grouped by country/province (internal network as its own row, unresolved IPs as null). */
export async function visitsByLocation(filter: VisitorFilter, limit = 15): Promise<LocationCount[]> {
  const { sql, values } = whereFor(filter);
  const rows = await selectRows<RowDataPacket>(
    `SELECT g.network, g.country, CASE WHEN g.network = 'private' THEN NULL ELSE g.region END AS region,
            COUNT(*) AS visits, COUNT(DISTINCT v.ip_address) AS ips, COUNT(DISTINCT v.user_id) AS users
     ${FROM} WHERE ${sql}
     GROUP BY g.network, g.country, CASE WHEN g.network = 'private' THEN NULL ELSE g.region END
     ORDER BY visits DESC LIMIT ?`,
    [...values, limit]
  );
  return rows.map((row) => ({ network: row.network ?? null, country: row.country ?? null, region: row.region ?? null, visits: Number(row.visits), ips: Number(row.ips), users: Number(row.users) }));
}

export type IpSummary = { ip: string; visits: number; users: string[]; areas: string[]; devices: string[]; firstSeen: string; lastSeen: string };

export async function visitsByIp(filter: VisitorFilter, page: number, pageSize = 25) {
  const { sql, values } = whereFor(filter);
  const [{ total }] = await selectRows<RowDataPacket & { total: number }>(`SELECT COUNT(DISTINCT v.ip_address) AS total ${FROM} WHERE ${sql}`, values);
  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const rows = await selectRows<RowDataPacket>(
    `SELECT v.ip_address, COUNT(*) AS visits,
            SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT v.user_name ORDER BY v.user_name SEPARATOR '\\n'), '\\n', 4) AS users,
            GROUP_CONCAT(DISTINCT v.area) AS areas, GROUP_CONCAT(DISTINCT v.device) AS devices,
            DATE_FORMAT(MIN(v.visited_at), '%Y-%m-%d %H:%i:%s') AS first_seen, DATE_FORMAT(MAX(v.visited_at), '%Y-%m-%d %H:%i:%s') AS last_seen
     ${FROM} WHERE ${sql}
     GROUP BY v.ip_address ORDER BY MAX(v.visited_at) DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (current - 1) * pageSize]
  );
  const ips: IpSummary[] = rows.map((row) => ({
    ip: String(row.ip_address),
    visits: Number(row.visits),
    users: String(row.users ?? "").split("\n").filter(Boolean),
    areas: String(row.areas ?? "").split(",").filter(Boolean),
    devices: String(row.devices ?? "").split(",").filter(Boolean),
    firstSeen: String(row.first_seen),
    lastSeen: String(row.last_seen),
  }));
  return { ips, total: Number(total), page: current, totalPages, pageSize };
}

export type VisitRow = { id: number; visitedAt: string; ip: string; area: string; path: string; userName: string | null; device: string | null; browser: string | null; referrer: string | null };

export async function recentVisits(filter: VisitorFilter, limit = 50): Promise<VisitRow[]> {
  const { sql, values } = whereFor(filter);
  const rows = await selectRows<RowDataPacket>(
    `SELECT v.id, DATE_FORMAT(v.visited_at, '%Y-%m-%d %H:%i:%s') AS visited_at, v.ip_address, v.area, v.path, v.user_name, v.device, v.browser, v.referrer_host
     ${FROM} WHERE ${sql} ORDER BY v.visited_at DESC, v.id DESC LIMIT ?`,
    [...values, limit]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    visitedAt: String(row.visited_at),
    ip: String(row.ip_address),
    area: String(row.area),
    path: String(row.path),
    userName: row.user_name ?? null,
    device: row.device ?? null,
    browser: row.browser ?? null,
    referrer: row.referrer_host ?? null,
  }));
}

export async function topPages(filter: VisitorFilter, limit = 10) {
  const { sql, values } = whereFor(filter);
  const rows = await selectRows<RowDataPacket>(
    `SELECT v.path, COUNT(*) AS visits, COUNT(DISTINCT v.ip_address) AS ips ${FROM} WHERE ${sql} GROUP BY v.path ORDER BY visits DESC LIMIT ?`,
    [...values, limit]
  );
  return rows.map((row) => ({ path: String(row.path), visits: Number(row.visits), ips: Number(row.ips) }));
}
