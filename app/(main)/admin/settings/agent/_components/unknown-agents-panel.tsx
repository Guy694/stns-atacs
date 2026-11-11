import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";
import { formatThaiDateTime } from "@/lib/date-format";
import type { UnknownAgentSummary } from "@/lib/agent-auth-failure";
import type { IpGeoRow } from "@/lib/visitor-log-data";
import { locationLabel } from "@/lib/visitor-log";

/**
 * Agents still reporting with an id that is no longer in the database (SEC8). Their key cannot be checked, so
 * they cannot be told to uninstall: someone has to remove them on the machine itself.
 */
export function UnknownAgentsPanel({ agents, geo }: { agents: UnknownAgentSummary[]; geo: Map<string, IpGeoRow> }) {
  if (agents.length === 0) return null;
  return (
    <section aria-labelledby="unknown-agents-heading" className="glass-panel overflow-hidden rounded-2xl border-[var(--state-warning-border)]">
      <div className="border-b border-[var(--line)] px-5 py-3">
        <h2 id="unknown-agents-heading" className="flex items-center gap-2 text-base font-semibold">
          <AppIcon name="warning" size={18} className="text-[var(--state-warning-fg)]" /> Agent ที่ไม่มีในระบบ ({agents.length.toLocaleString("th-TH")})
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          เครื่องเหล่านี้ยังติดตั้ง Agent อยู่ แต่ข้อมูลเครื่องถูกลบออกจากฐานข้อมูลแล้ว ระบบจึงสั่งถอนจากระยะไกลไม่ได้ —
          ให้ถอนที่ตัวเครื่องด้วยคำสั่งถอนการติดตั้งด้านล่าง หรือติดตั้งใหม่ถ้าต้องการใช้งานต่อ (90 วันล่าสุด)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">เครื่อง (จากข้อมูลที่ Agent ส่งมา)</th>
              <th className="px-4 py-2.5 text-right font-medium">ส่งมา</th>
              <th className="px-4 py-2.5 font-medium">IP ล่าสุด</th>
              <th className="px-4 py-2.5 font-medium">ช่วงเวลา</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.agentId} className="border-t border-[var(--line)] align-top">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{agent.machine?.replace(/^[^·]*ไม่มีในระบบ[^·]*·\s*/, "") ?? "ไม่ทราบข้อมูลเครื่อง (Agent ส่ง heartbeat อย่างเดียว)"}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">{agent.agentId}</p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{agent.reports.toLocaleString("th-TH")} ครั้ง</td>
                <td className="px-4 py-2.5 text-xs">
                  <span className="font-mono">{agent.ips[0]}</span>
                  <span className="block text-[var(--muted)]">{locationLabel(geo.get(agent.ips[0]) ?? null)}</span>
                  {agent.ips.length > 1 && <span className="block text-[var(--muted)]">และอีก {(agent.ips.length - 1).toLocaleString("th-TH")} IP</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--muted)]">
                  {formatThaiDateTime(agent.firstSeen)}
                  <span className="block">ถึง {formatThaiDateTime(agent.lastSeen)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--line)] px-5 py-2.5 text-xs text-[var(--muted)]">
        ประวัติทั้งหมด: <Link href="/admin/security/?type=agent_unknown_id&days=90" className="font-medium text-[var(--primary-text)] hover:underline">ความปลอดภัยระบบ › บันทึกเหตุการณ์</Link>
      </p>
    </section>
  );
}
