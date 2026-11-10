import type { HealthIssueCode, HealthSeverity } from "./agent-health";
import { osFamily, type AgentConnectionState, type OsFamilyKey } from "./agent-monitor-summary";

/** "" = every machine (default). "issues" hides healthy machines and ones whose only notes are housekeeping. */
export type SeverityFilter = "" | "issues" | "critical" | "warning";

const HOUSEKEEPING: readonly HealthIssueCode[] = ["agent-outdated", "no-serial"];

export function normalizeSeverityFilter(value: string | null | undefined): SeverityFilter {
  return value === "issues" || value === "critical" || value === "warning" ? value : "";
}

type FilterRow = {
  device: {
    id: number;
    hostname?: string | null;
    currentUser?: string | null;
    facilityName?: string | null;
    linkedAssetRegistrationNo?: string | null;
    manufacturerModel?: string | null;
    operatingSystem?: string | null;
  };
  worst: HealthSeverity | null;
  issues: { code: HealthIssueCode }[];
};

export function filterMonitorRows<T extends FilterRow>(
  rows: readonly T[],
  options: {
    connectionOf: ReadonlyMap<number, AgentConnectionState>;
    severity?: string;
    issue?: HealthIssueCode | "";
    conn?: AgentConnectionState | "";
    os?: OsFamilyKey | "";
    query?: string;
  }
): T[] {
  const severity = normalizeSeverityFilter(options.severity);
  const query = (options.query ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    const state = options.connectionOf.get(row.device.id) ?? "never";
    // "ออฟไลน์" รวมเครื่องที่ยังไม่เคยรายงานด้วย ให้ตรงกับการ์ดสรุปด้านบน
    if (options.conn === "offline" ? state === "online" : options.conn && state !== options.conn) return false;
    if (options.os && osFamily(row.device.operatingSystem) !== options.os) return false;
    if (options.issue && !row.issues.some((item) => item.code === options.issue)) return false;
    if (severity === "critical" && row.worst !== "critical") return false;
    if (severity === "warning" && row.worst !== "critical" && row.worst !== "warning") return false;
    if (severity === "issues" && row.issues.every((item) => HOUSEKEEPING.includes(item.code))) return false;
    if (query) {
      const haystack = [row.device.hostname, row.device.currentUser, row.device.facilityName, row.device.linkedAssetRegistrationNo, row.device.manufacturerModel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
