import Link from "next/link";
import { redirect } from "next/navigation";

import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { listAgentDevices } from "@/lib/agent";
import {
  HEALTH_ISSUE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_RANK,
  summarizeAgentMonitor,
  type HealthIssueCode,
  type HealthSeverity,
} from "@/lib/agent-health";
import {
  agentConnectionState,
  agentOfflineThresholdMinutes,
  CONNECTION_LABELS,
  isConnectionState,
  isOsFamilyKey,
  osFamilyLabel,
  summarizeAgentFleet,
  type AgentConnectionState,
} from "@/lib/agent-monitor-summary";
import { AGENT_LATEST_VERSION } from "@/lib/agent-payload";
import { AGENT_LIFECYCLE_LABELS } from "@/lib/agent-uninstall";
import { getCurrentUser } from "@/lib/auth";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { formatThaiDateTime } from "@/lib/date-format";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { pageHref, paginate, readPage, readSort, sortHref, sortRows } from "@/lib/table-sort";

import { filterMonitorRows, normalizeSeverityFilter } from "@/lib/agent-monitor-filter";
import { isMissingSchemaError } from "@/lib/schema-errors";

import { FleetDashboard } from "./_components/fleet-dashboard";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const TONE: Record<HealthSeverity, "danger" | "warning" | "info"> = { critical: "danger", warning: "warning", info: "info" };
const CONNECTION_TONE: Record<AgentConnectionState, "success" | "danger" | "neutral"> = { online: "success", offline: "danger", never: "neutral" };
const SEVERITY_FILTERS = [
  { key: "", label: "ทุกเครื่อง" },
  { key: "issues", label: "เฉพาะที่มีปัญหา" },
  { key: "warning", label: "วิกฤต + ควรแก้ไข" },
  { key: "critical", label: "วิกฤต" },
] as const;

function DiskBar({ volume }: { volume: { mount: string; totalGb: number; freeGb: number } | null }) {
  if (!volume) return <span className="text-xs text-[var(--muted)]">-</span>;
  const usedPercent = Math.min(100, Math.max(0, 100 - (volume.freeGb / volume.totalGb) * 100));
  const color = usedPercent >= 95 ? "bg-red-500" : usedPercent >= 90 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="min-w-[140px]">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{volume.mount}</span>
        <span className="text-[var(--muted)]">ว่าง {volume.freeGb.toLocaleString("th-TH", { maximumFractionDigits: 1 })} / {volume.totalGb.toLocaleString("th-TH", { maximumFractionDigits: 0 })} GB</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10" role="img" aria-label={`ใช้ไป ${usedPercent.toFixed(0)}%`}>
        <div className={`h-full ${color}`} style={{ width: `${usedPercent}%` }} />
      </div>
    </div>
  );
}

export default async function AgentMonitorPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = user.role === "admin" || (await hasPermission(user.role, "agent.manage"));
  if (!allowed || user.role === "viewer") redirect("/dashboard");

  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const params = await searchParams;
  const requestedFacility = Number(one(params.facility)) || 0;
  // เจ้าหน้าที่เห็นเฉพาะหน่วยงานตัวเองเสมอ ตัวกรองหน่วยงานใช้ได้เฉพาะผู้ดูแลระบบ
  const facilityId = facilityScopeId ?? (requestedFacility > 0 ? requestedFacility : undefined);
  // ค่าเริ่มต้นแสดงทุกเครื่อง (เดิมซ่อนเครื่องที่ปกติ ทำให้หน้าว่างเมื่อทุกเครื่องปกติ)
  const severity = normalizeSeverityFilter(one(params.severity));
  const issue = one(params.issue) as HealthIssueCode | "";
  const query = one(params.q).trim().toLowerCase().slice(0, 100);
  const osParam = one(params.os);
  const os = isOsFamilyKey(osParam) ? osParam : "";
  const connParam = one(params.conn);
  const conn = isConnectionState(connParam) ? connParam : "";

  let devices: Awaited<ReturnType<typeof listAgentDevices>> = [];
  let dbError = "";
  try {
    devices = await listAgentDevices(facilityId ? { facilityId } : undefined);
  } catch (error) {
    console.error("[agent-monitor] listAgentDevices failed", error);
    dbError = isMissingSchemaError(error)
      ? "ยังไม่พบตาราง Agent กรุณารัน database/agent_inventory.sql"
      : "โหลดรายการเครื่องไม่สำเร็จ (ฐานข้อมูลไม่ตอบสนอง) กรุณารีเฟรชหน้านี้อีกครั้ง";
  }
  const facilities = facilityScopeId ? [] : await listAllFacilitiesForSelect();
  const now = new Date();
  const summary = summarizeAgentMonitor(devices, now);
  const offlineMinutes = agentOfflineThresholdMinutes(process.env.AGENT_OFFLINE_MINUTES);
  // ส่งทุกเครื่อง: เครื่องที่ถอนการติดตั้ง/ลบออกจากระบบแล้วไม่นับใน KPI แต่แสดงเป็นจำนวนแยก (fleet.retired)
  const fleet = summarizeAgentFleet(devices, { now, latestVersion: AGENT_LATEST_VERSION, offlineMinutes });
  const connectionOf = new Map(summary.rows.map((row) => [row.device.id, agentConnectionState(row.device, now, offlineMinutes)]));

  const visibleRows = filterMonitorRows(summary.rows, { connectionOf, severity, issue, conn, os, query });

  const sort = readSort(params, ["device", "disk", "issues", "lastSeen"]);
  const sorted = sortRows(visibleRows, sort, {
    device: (row) => row.device.hostname ?? `Device #${row.device.id}`,
    disk: (row) => (row.volume && row.volume.totalGb > 0 ? 100 - (row.volume.freeGb / row.volume.totalGb) * 100 : null),
    issues: (row) => (row.worst ? SEVERITY_RANK[row.worst] : 0) * 1000 + row.issues.length,
    lastSeen: (row) => row.device.lastSeenAt,
  });
  const paged = paginate(sorted, readPage(params));
  const th = (key: string, label: string, firstDir: "asc" | "desc" = "asc") => (
    <SortableTh key={key} label={label} sortKey={key} sort={sort} className="px-4 py-3 font-medium" href={sortHref("/agent-monitor", params, key, sort, "", firstDir)} />
  );

  const linkWith = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { facility: facilityScopeId ? "" : String(facilityId ?? ""), severity, issue, q: query, os, conn, sort: sort?.key ?? "", dir: sort?.dir ?? "", ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const text = next.toString();
    return text ? `/agent-monitor?${text}` : "/agent-monitor";
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-[var(--accent-strong)]">สุขภาพเครื่องคอมพิวเตอร์</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">สุขภาพเครื่องคอมพิวเตอร์</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ข้อมูลจาก ATACS Agent ที่ติดตั้งในเครื่อง (ส่งทุก 4 ชั่วโมงและตอนเปิดเครื่อง) ตารางเรียงจากปัญหาหนักที่สุด
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">ข้อมูล ณ {formatThaiDateTime(now)}</p>
      </div>

      {dbError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{dbError}</div>}

      {!dbError && summary.total === 0 ? (
        <section className="glass-panel rounded-2xl px-5 py-10 text-center">
          <h2 className="text-base font-semibold">ยังไม่มีเครื่องที่ติดตั้ง Agent{facilityId && !facilityScopeId ? "ในหน่วยงานนี้" : ""}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">ติดตั้ง ATACS Agent ในเครื่องคอมพิวเตอร์ของหน่วยงาน แล้วข้อมูลสุขภาพเครื่องจะแสดงที่หน้านี้</p>
          <Link href="/agent-download" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:opacity-90">
            ดาวน์โหลด Agent
          </Link>
        </section>
      ) : summary.total > 0 ? (
        <FleetDashboard
          fleet={fleet}
          critical={summary.critical}
          latestVersion={AGENT_LATEST_VERSION}
          offlineMinutes={offlineMinutes}
          activeOs={os}
          activeConnection={conn}
          showFacilities={!facilityScopeId && !facilityId}
          linkWith={linkWith}
        />
      ) : null}

      {fleet.retired > 0 && (
        <p className="text-xs text-[var(--muted)]">
          ไม่นับ {fleet.retired.toLocaleString("th-TH")} เครื่องที่ถอนการติดตั้งหรือลบออกจากระบบแล้ว
          {fleet.uninstallPending > 0 ? ` · รอถอนการติดตั้ง ${fleet.uninstallPending.toLocaleString("th-TH")} เครื่อง (ยังนับรวม)` : ""}
          {" "}— จัดการได้ที่ <Link href="/admin/settings/agent" className="font-medium text-[var(--primary)] hover:underline">ตั้งค่าระบบ › Agent</Link>
        </p>
      )}

      {summary.total > 0 && summary.withHealthData < summary.total && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          มี {(summary.total - summary.withHealthData).toLocaleString("th-TH")} เครื่องที่ยังใช้ Agent รุ่นเก่า ระบบตรวจได้เฉพาะพื้นที่ดิสก์รวม รุ่น OS และ RAM
          — ติดตั้ง Agent ใหม่จากเมนูดาวน์โหลด Agent เพื่อดูไดรฟ์รายตัว สถานะฮาร์ดดิสก์ แอนตี้ไวรัส Windows Update และการ Activate
          (ผู้ดูแลระบบต้องรัน database/add_agent_health.sql ก่อน)
        </p>
      )}

      {summary.issueCounts.length > 0 && (
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold">ปัญหาที่พบ (จำนวนเครื่อง)</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={linkWith({ issue: "" })} className={`rounded-full border px-3 py-1 text-xs font-medium ${!issue ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-black/10 bg-white/70"}`}>
              ทั้งหมด
            </Link>
            {summary.issueCounts.map((item) => (
              <Link
                key={item.code}
                href={linkWith({ issue: item.code, severity: "all" })}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${issue === item.code ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-black/10 bg-white/70"}`}
              >
                {item.label} <span className={item.critical ? "text-red-600" : item.warning ? "text-amber-700" : "text-[var(--muted)]"}>{item.total.toLocaleString("th-TH")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <form method="GET" className="glass-panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
        {!facilityScopeId && (
          <div className="min-w-[240px] text-sm">
            <label htmlFor="monitor-facility" className="block text-xs text-[var(--muted)]">หน่วยงาน</label>
            <FacilitySelect
              id="monitor-facility"
              name="facility"
              emptyLabel="ทุกหน่วยงาน"
              defaultValue={String(facilityId ?? "")}
              className="mt-1"
              facilities={facilities.map((facility) => ({ id: facility.id, name: facility.facility_name, typecode: facility.typecode, districtName: facility.district_name }))}
            />
          </div>
        )}
        <label className="text-sm">
          <span className="block text-xs text-[var(--muted)]">ระดับ</span>
          <select name="severity" defaultValue={severity} className="mt-1 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm">
            {SEVERITY_FILTERS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="block text-xs text-[var(--muted)]">ค้นหา</span>
          <input name="q" defaultValue={query} placeholder="ชื่อเครื่อง ผู้ใช้ เลขทะเบียน รุ่น" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm" />
        </label>
        {issue && <input type="hidden" name="issue" value={issue} />}
        {os && <input type="hidden" name="os" value={os} />}
        {conn && <input type="hidden" name="conn" value={conn} />}
        {sort && <input type="hidden" name="sort" value={sort.key} />}
        {sort && <input type="hidden" name="dir" value={sort.dir} />}
        <button type="submit" className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">กรอง</button>
        <Link href="/agent-monitor" className="px-2 py-2 text-sm text-[var(--muted)] hover:underline">ล้าง</Link>
      </form>

      <section className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-black/6 px-5 py-3 text-sm text-[var(--muted)]">
          แสดง {visibleRows.length.toLocaleString("th-TH")} จาก {summary.total.toLocaleString("th-TH")} เครื่อง
          {issue ? ` · ปัญหา: ${HEALTH_ISSUE_LABELS[issue] ?? issue}` : ""}
          {os && (
            <Link href={linkWith({ os: "" })} className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary-text)] hover:underline">
              {osFamilyLabel(os)} <span aria-hidden>×</span><span className="sr-only">ล้างตัวกรองระบบปฏิบัติการ</span>
            </Link>
          )}
          {conn && (
            <Link href={linkWith({ conn: "" })} className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary-text)] hover:underline">
              {CONNECTION_LABELS[conn]} <span aria-hidden>×</span><span className="sr-only">ล้างตัวกรองสถานะการเชื่อมต่อ</span>
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="w-12 px-4 py-3 text-center">ลำดับ</th>
                {th("device", "เครื่อง")}
                {th("disk", "ไดรฟ์ระบบ", "desc")}
                {th("issues", "ปัญหาที่พบ", "desc")}
                {th("lastSeen", "ส่งข้อมูลล่าสุด", "desc")}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                    {summary.total === 0 ? (
                      "ยังไม่มีเครื่องที่ติดตั้ง Agent"
                    ) : (
                      <>
                        ไม่พบเครื่องตามเงื่อนไขที่เลือก{" "}
                        <Link href="/agent-monitor" className="font-medium text-[var(--primary)] hover:underline">แสดงทุกเครื่อง</Link>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                paged.rows.map((row, index) => (
                  <tr key={row.device.id} className="border-t border-black/5 align-top">
                    <td className="px-4 py-3 text-center tabular-nums text-[var(--muted)]">{(paged.start + index).toLocaleString("th-TH")}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.device.hostname ?? `Device #${row.device.id}`}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {[row.device.manufacturerModel, row.device.operatingSystem].filter(Boolean).join(" · ") || "-"}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {row.device.facilityName}
                        {row.device.currentUser ? ` · ผู้ใช้ ${row.device.currentUser}` : ""}
                        {row.device.ramMb ? ` · RAM ${(row.device.ramMb / 1024).toFixed(0)} GB` : ""}
                      </p>
                      {row.device.uninstallRequestedAt && (
                        <StatusBadge tone="warning" className="mt-1 text-[10px]">{AGENT_LIFECYCLE_LABELS["uninstall-pending"]}</StatusBadge>
                      )}
                      {row.device.linkedAssetId && (
                        <Link href={`/assets/${row.device.linkedAssetId}`} className="text-xs font-semibold text-[var(--primary)] hover:underline">
                          {row.device.linkedAssetRegistrationNo ?? "ดูทะเบียน"}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3"><DiskBar volume={row.volume} /></td>
                    <td className="px-4 py-3">
                      {row.issues.length === 0 ? (
                        <StatusBadge tone="success">ปกติ</StatusBadge>
                      ) : (
                        <ul className="space-y-1.5">
                          {row.issues.map((item, itemIndex) => (
                            <li key={`${item.code}-${itemIndex}`} className="flex flex-wrap items-start gap-2">
                              <StatusBadge tone={TONE[item.severity]} className="shrink-0 text-[10px]">{SEVERITY_LABELS[item.severity]}</StatusBadge>
                              <span>
                                <span className="font-medium">{item.title}</span>
                                <span className="block text-xs text-[var(--muted)]">{item.detail}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                      {(() => {
                        const state = connectionOf.get(row.device.id) ?? "never";
                        return <StatusBadge tone={CONNECTION_TONE[state]} className="mb-1 text-[10px]">{CONNECTION_LABELS[state]}</StatusBadge>;
                      })()}
                      <span className="block">{row.device.lastSeenAt ? formatThaiDateTime(row.device.lastSeenAt) : "-"}</span>
                      <span className="block">Agent {row.device.agentVersion ?? "-"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...paged} hrefFor={(page) => pageHref("/agent-monitor", params, page)} label="แบ่งหน้ารายการเครื่อง" className="border-t border-black/6" />
      </section>
    </div>
  );
}
