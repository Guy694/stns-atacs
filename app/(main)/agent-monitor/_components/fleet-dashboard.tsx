import Link from "next/link";

import { Panel, StatTile } from "@/app/_components/asset-overview-charts";
import { StatusPie } from "@/app/_components/status-pie";
import { CONNECTION_LABELS, percentOf, type AgentConnectionState, type AgentFleetSummary, type OsFamilyKey } from "@/lib/agent-monitor-summary";

import { LinkBars, type LinkBarRow } from "./link-bars";

const COLORS = {
  online: "#10b981",
  offline: "#f43f5e",
  never: "#94a3b8",
  bar: "#2563eb",
  warning: "#f59e0b",
  muted: "#cbd5e1",
};

const numberFormat = new Intl.NumberFormat("th-TH");

type LinkWith = (patch: Record<string, string>) => string;

export function thresholdLabel(minutes: number) {
  return minutes % 60 === 0 ? `${numberFormat.format(minutes / 60)} ชั่วโมง` : `${numberFormat.format(minutes)} นาที`;
}

export function FleetDashboard({
  fleet,
  critical,
  latestVersion,
  offlineMinutes,
  activeOs,
  activeConnection,
  showFacilities,
  linkWith,
}: {
  fleet: AgentFleetSummary;
  critical: number;
  latestVersion: string;
  offlineMinutes: number;
  activeOs: OsFamilyKey | "";
  activeConnection: AgentConnectionState | "";
  showFacilities: boolean;
  linkWith: LinkWith;
}) {
  const { total, connection } = fleet;
  const offlineTotal = connection.offline + connection.never;

  const osRows: LinkBarRow[] = fleet.os.map((family) => ({
    key: family.key,
    label: family.label,
    count: family.count,
    color: family.warning ? COLORS.warning : family.key === "unknown" ? COLORS.muted : COLORS.bar,
    badge: family.warning ? { text: "ควรเปลี่ยน", tone: "warning" } : undefined,
    active: activeOs === family.key,
    href: linkWith({ os: activeOs === family.key ? "" : family.key, severity: "all", page: "" }),
  }));

  const versionRows: LinkBarRow[] = fleet.versions.map((version) => ({
    key: version.key || "unknown",
    label: version.key ? `Agent ${version.label}` : version.label,
    count: version.count,
    color: version.latest ? COLORS.online : version.outdated ? (version.key ? COLORS.warning : COLORS.muted) : COLORS.bar,
    badge: version.latest ? { text: "ล่าสุด", tone: "success" } : version.outdated && version.key ? { text: "รุ่นเก่า", tone: "warning" } : undefined,
  }));

  const windowsTotal = fleet.activation.licensed + fleet.activation.notLicensed + fleet.activation.noData;
  const antivirusTotal = fleet.antivirus.ok + fleet.antivirus.disabled + fleet.antivirus.outdated + fleet.antivirus.missing + fleet.antivirus.noData;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <StatTile label="เครื่องทั้งหมด" value={numberFormat.format(total)} unit="เครื่อง" detail="ติดตั้ง Agent และเปิดใช้งานอยู่" />
        </div>
        <StatTile
          label="ออนไลน์"
          value={numberFormat.format(connection.online)}
          unit={`(${percentOf(connection.online, total)}%)`}
          detail={`ส่งข้อมูลภายใน ${thresholdLabel(offlineMinutes)}`}
          href={linkWith({ conn: "online", severity: "all", page: "" })}
        />
        <StatTile
          label="ออฟไลน์"
          value={numberFormat.format(offlineTotal)}
          unit={`(${percentOf(offlineTotal, total)}%)`}
          detail={connection.never > 0 ? `รวมยังไม่เคยรายงาน ${numberFormat.format(connection.never)} เครื่อง · กดเพื่อดูรายการ` : "กดเพื่อดูรายการเครื่องออฟไลน์"}
          href={linkWith({ conn: "offline", severity: "all", page: "" })}
        />
        <StatTile
          label="มีปัญหาวิกฤต"
          value={numberFormat.format(critical)}
          unit="เครื่อง"
          detail="ดิสก์เต็ม/เสีย แอนตี้ไวรัสถูกปิด หรือ OS หมดการสนับสนุน"
          href={linkWith({ severity: "critical", issue: "", page: "" })}
        />
        <StatTile
          label="Agent เวอร์ชันเก่า"
          value={numberFormat.format(fleet.outdatedAgents)}
          unit="เครื่อง"
          detail={`รุ่นล่าสุด ${latestVersion}`}
          href={linkWith({ issue: "agent-outdated", severity: "all", page: "" })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          id="agent-connection"
          title="สถานะการเชื่อมต่อ"
          subtitle={`ออฟไลน์ = ไม่ส่งข้อมูลเกิน ${thresholdLabel(offlineMinutes)}`}
          action={activeConnection ? <Link href={linkWith({ conn: "", page: "" })} className="text-xs font-medium text-[var(--primary)] hover:underline">ล้างตัวกรอง</Link> : undefined}
        >
          <StatusPie
            ariaLabel="สถานะการเชื่อมต่อของเครื่อง"
            totalLabel="เครื่อง"
            items={[
              { label: CONNECTION_LABELS.online, count: connection.online, color: COLORS.online },
              { label: CONNECTION_LABELS.offline, count: connection.offline, color: COLORS.offline },
              ...(connection.never > 0 ? [{ label: CONNECTION_LABELS.never, count: connection.never, color: COLORS.never }] : []),
            ]}
          />
          <nav aria-label="กรองตามสถานะการเชื่อมต่อ" className="mt-4 flex flex-wrap gap-2">
            {(["online", "offline", ...(connection.never > 0 ? ["never" as const] : [])] as AgentConnectionState[]).map((state) => (
              <Link
                key={state}
                href={linkWith({ conn: activeConnection === state ? "" : state, severity: "all", page: "" })}
                aria-current={activeConnection === state ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${activeConnection === state ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--line)] bg-white hover:bg-[var(--primary-soft)]"}`}
              >
                ดูเครื่อง{CONNECTION_LABELS[state]}
              </Link>
            ))}
          </nav>
        </Panel>

        <Panel
          id="agent-os"
          title="ระบบปฏิบัติการ"
          subtitle="กดแถบเพื่อกรองตารางด้านล่าง"
          action={activeOs ? <Link href={linkWith({ os: "", page: "" })} className="text-xs font-medium text-[var(--primary)] hover:underline">ล้างตัวกรอง</Link> : undefined}
        >
          <LinkBars rows={osRows} />
        </Panel>

        <Panel id="agent-version" title="รุ่น Agent" subtitle={`รุ่นล่าสุด ${latestVersion} · รุ่นเก่าควรติดตั้งใหม่`}>
          <LinkBars rows={versionRows} />
        </Panel>
      </div>

      {(windowsTotal > 0 || (showFacilities && fleet.facilitiesByOffline.length > 0)) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {windowsTotal > 0 && (
            <Panel id="agent-activation" title="การ Activate Windows" subtitle={`เครื่อง Windows ${numberFormat.format(windowsTotal)} เครื่อง`}>
              <StatusPie
                ariaLabel="สถานะการ Activate Windows"
                totalLabel="เครื่อง"
                items={[
                  { label: "Activate แล้ว", count: fleet.activation.licensed, color: COLORS.online },
                  { label: "ไม่ได้ Activate", count: fleet.activation.notLicensed, color: COLORS.offline },
                  { label: "ไม่มีข้อมูล (Agent รุ่นเก่า)", count: fleet.activation.noData, color: COLORS.muted },
                ]}
              />
            </Panel>
          )}
          {antivirusTotal > 0 && (
            <Panel id="agent-antivirus" title="โปรแกรมป้องกันไวรัส" subtitle="เฉพาะ Windows ที่ไม่ใช่ Server">
              <StatusPie
                ariaLabel="สถานะโปรแกรมป้องกันไวรัส"
                totalLabel="เครื่อง"
                items={[
                  { label: "ทำงานปกติ", count: fleet.antivirus.ok, color: COLORS.online },
                  { label: "ถูกปิด", count: fleet.antivirus.disabled, color: COLORS.offline },
                  { label: "ฐานข้อมูลไม่เป็นปัจจุบัน", count: fleet.antivirus.outdated, color: COLORS.warning },
                  { label: "ไม่พบโปรแกรม", count: fleet.antivirus.missing, color: COLORS.never },
                  { label: "ไม่มีข้อมูล (Agent รุ่นเก่า)", count: fleet.antivirus.noData, color: COLORS.muted },
                ]}
              />
            </Panel>
          )}
          {showFacilities && fleet.facilitiesByOffline.length > 0 && (
            <Panel id="agent-facility-offline" title="หน่วยงานที่มีเครื่องออฟไลน์มากที่สุด" subtitle="10 อันดับแรก รวมเครื่องที่ยังไม่เคยรายงาน">
              <ol className="space-y-1 text-sm">
                {fleet.facilitiesByOffline.map((facility, index) => (
                  <li key={facility.facilityId}>
                    <Link
                      href={linkWith({ facility: String(facility.facilityId), conn: "offline", severity: "all", page: "" })}
                      className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                    >
                      <span className="flex min-w-0 gap-2">
                        <span className="w-5 shrink-0 text-right tabular-nums text-[var(--muted)]">{numberFormat.format(index + 1)}</span>
                        <span className="truncate" title={facility.facilityName}>{facility.facilityName}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold text-[var(--state-danger-fg)]">{numberFormat.format(facility.offline)}</span>
                        <span className="text-xs text-[var(--muted)]"> / {numberFormat.format(facility.total)} เครื่อง</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
