/**
 * What to do when an agent's credentials are rejected (SEC8).
 * - wrong-key: the agent id exists and is active but the key is wrong → someone may have copied the id: alert.
 * - retired:   the machine was uninstalled/removed by an admin → 2.2+ agents remove themselves (AGENT_RETIRED).
 * - unknown:   the id is not in the database at all (row deleted, database restored) → a stale agent, not an attack.
 *              Logged quietly with the machine's own description so an admin can find and uninstall it.
 */
export type AgentAuthFailure = {
  kind: "wrong-key" | "retired" | "unknown";
  eventType: "agent_invalid_credentials" | "agent_retired_report" | "agent_unknown_id";
  alertSecurity: boolean;
  code: "AGENT_INVALID" | "AGENT_RETIRED" | "AGENT_UNKNOWN";
};

export function classifyAgentAuthFailure(device: { isActive: boolean } | null): AgentAuthFailure {
  if (!device) return { kind: "unknown", eventType: "agent_unknown_id", alertSecurity: false, code: "AGENT_UNKNOWN" };
  if (!device.isActive) return { kind: "retired", eventType: "agent_retired_report", alertSecurity: false, code: "AGENT_RETIRED" };
  return { kind: "wrong-key", eventType: "agent_invalid_credentials", alertSecurity: true, code: "AGENT_INVALID" };
}

const field = (value: unknown, max = 80) =>
  typeof value === "string" ? value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, max) || null : null;

/** "เครื่อง X · ผู้ใช้ Y · SN Z · OS · Agent v" from an (untrusted) report payload. */
export function describeReportingMachine(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "ไม่ทราบข้อมูลเครื่อง";
  const data = payload as Record<string, unknown>;
  const parts = [
    field(data.hostname) && `เครื่อง ${field(data.hostname)}`,
    field(data.currentUser) && `ผู้ใช้ ${field(data.currentUser)}`,
    field(data.serialNumber, 60) && `SN ${field(data.serialNumber, 60)}`,
    field(data.operatingSystem),
    field(data.agentVersion, 20) && `Agent ${field(data.agentVersion, 20)}`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ").slice(0, 400) : "ไม่ทราบข้อมูลเครื่อง";
}

export type UnknownAgentEvent = { identity: string | null; ip: string; detail: string | null; createdAt: string };
export type UnknownAgentSummary = { agentId: string; reports: number; ips: string[]; machine: string | null; firstSeen: string; lastSeen: string };

/** One row per agent id, most recently active first. `ips` newest first. */
export function summarizeUnknownAgents(rows: readonly UnknownAgentEvent[]): UnknownAgentSummary[] {
  const byId = new Map<string, UnknownAgentEvent[]>();
  for (const row of rows) {
    const id = row.identity?.trim();
    if (!id) continue;
    byId.set(id, [...(byId.get(id) ?? []), row]);
  }
  return [...byId.entries()]
    .map(([agentId, events]) => {
      const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        agentId,
        reports: sorted.length,
        ips: [...new Set(sorted.map((event) => event.ip))],
        machine: sorted.find((event) => event.detail)?.detail ?? null,
        firstSeen: sorted.at(-1)!.createdAt,
        lastSeen: sorted[0].createdAt,
      };
    })
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
