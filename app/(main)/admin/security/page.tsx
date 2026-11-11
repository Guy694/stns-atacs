import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, PageHero, SummaryCard } from "@/app/(main)/admin/_components/page-hero";
import { TablePagination } from "@/app/_components/ui/data-table";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { formatThaiDateTime } from "@/lib/date-format";
import { todayBangkok } from "@/lib/local-date";
import { isMissingSchemaError } from "@/lib/schema-errors";
import {
  buildDailySeries,
  describeSecurityEvent,
  SECURITY_EVENT_GROUPS,
  summarizeSecurityKpis,
  type SecurityTone,
} from "@/lib/security-dashboard";
import { countEventsByType, dailyEventCounts, listSecurityEvents, topSuspiciousIps } from "@/lib/security-dashboard-data";
import { readSecurityFilter, SECURITY_WINDOWS, type SecurityFilterParams } from "@/lib/security-filter";
import { buildSystemChecks, overallStatus, type CheckStatus } from "@/lib/system-health";
import { probeSystem } from "@/lib/system-health-probe";

import { getPasswordLoginState, loginMethodCoverage } from "@/lib/password-login";

import { ensureIpGeoInBackground, geoForIps } from "@/lib/visitor-log-data";

import { DailyChart } from "./_components/daily-chart";
import { IpLocation } from "./_components/ip-location";
import { LoginMethodsPanel } from "./_components/login-methods-panel";
import { SessionsPanel } from "./_components/sessions-panel";
import { listActiveSessions } from "@/lib/session-admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TONE_BADGE: Record<SecurityTone, "success" | "info" | "warning" | "danger"> = { success: "success", info: "info", warning: "warning", danger: "danger" };
const CHECK_BADGE: Record<CheckStatus, "success" | "warning" | "danger"> = { ok: "success", warning: "warning", critical: "danger" };
const CHECK_LABEL: Record<CheckStatus, string> = { ok: "ปกติ", warning: "ควรตรวจ", critical: "มีปัญหา" };
const WINDOW_LABEL: Record<number, string> = { 1: "24 ชั่วโมง", 7: "7 วัน", 30: "30 วัน", 90: "90 วัน" };
const n = (value: number) => value.toLocaleString("th-TH");

function hrefWith(filter: SecurityFilterParams, patch: Partial<Record<keyof SecurityFilterParams | "page", string | number | undefined>>, path = "/admin/security/") {
  const merged: Record<string, string | number | undefined> = { ...filter, ...patch };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || (key === "days" && value === 7) || (key === "page" && Number(value) <= 1)) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function uptimeText(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days} วัน ${hours} ชม.` : hours ? `${hours} ชม. ${minutes} นาที` : `${minutes} นาที`;
}

export default async function SecurityDashboardPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const filter = readSecurityFilter(params);
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const now = new Date();

  const one = (key: string) => {
    const value = params[key];
    return ((Array.isArray(value) ? value[0] : value) ?? "").slice(0, 300);
  };
  const [system, passwordLogin, coverage, sessionList] = await Promise.all([
    probeSystem(now),
    getPasswordLoginState(),
    loginMethodCoverage().catch(() => []),
    listActiveSessions().catch(() => ({ sessions: [], tracked: false })),
  ]);
  const sessionIps = sessionList.sessions.map((session) => session.lastIp ?? session.ip).filter((ip): ip is string => Boolean(ip));
  const sessionGeo = await geoForIps(sessionIps);
  ensureIpGeoInBackground(sessionIps.filter((ip) => !sessionGeo.has(ip)));
  const checks = buildSystemChecks(system, { backupMaxAgeHours: Number(process.env.BACKUP_MAX_AGE_HOURS ?? 36) || 36 });
  const overall = overallStatus(checks);

  let loadError = "";
  let data: {
    kpi: ReturnType<typeof summarizeSecurityKpis>;
    byType: Awaited<ReturnType<typeof countEventsByType>>;
    series: ReturnType<typeof buildDailySeries>;
    ips: Awaited<ReturnType<typeof topSuspiciousIps>>;
    events: Awaited<ReturnType<typeof listSecurityEvents>>;
    geo: Awaited<ReturnType<typeof geoForIps>>;
  } | null = null;
  try {
    const [byType, daily, ips, events] = await Promise.all([
      countEventsByType(filter.days * 24),
      dailyEventCounts(30),
      topSuspiciousIps(filter.days),
      listSecurityEvents(filter, page),
    ]);
    const allIps = [...ips.map((item) => item.ip), ...events.rows.map((row) => row.ip)];
    const geo = await geoForIps(allIps);
    ensureIpGeoInBackground(allIps.filter((ip) => !geo.has(ip)));
    data = { kpi: summarizeSecurityKpis(byType), byType, series: buildDailySeries(daily, { days: 30, today: todayBangkok(now) }), ips, events, geo };
  } catch (error) {
    console.error("[admin/security] load failed", error);
    loadError = isMissingSchemaError(error)
      ? "ยังไม่มีตาราง security_events กรุณารัน database/add_security_events.sql"
      : "โหลดบันทึกความปลอดภัยไม่สำเร็จ (ฐานข้อมูลไม่ตอบสนอง) กรุณารีเฟรชหน้านี้";
  }

  const windowLabel = WINDOW_LABEL[filter.days];
  const hasEventFilter = Boolean(filter.group || filter.type || filter.ip || filter.search);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHero
        icon="shield"
        image="it-storage"
        title="ความปลอดภัยระบบ"
        description="สถานะเซิร์ฟเวอร์ การเข้าสู่ระบบ และเหตุการณ์ผิดปกติ จากบันทึกความปลอดภัยของระบบ (เก็บ IP ทุกเหตุการณ์)"
        actions={
          <>
          <Link href="/admin/security/visitors/" className="primary-action action-sm gap-2">
            <AppIcon name="globe" size={16} /> ผู้เข้าใช้งานและตำแหน่ง IP
          </Link>
          <a href={withBasePath(hrefWith(filter, {}, "/api/export/security/"))} className="secondary-action action-sm gap-2">
            <AppIcon name="download" size={16} /> ส่งออก CSV
          </a>
          </>
        }
      >
        <nav aria-label="ช่วงเวลา" className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
          {SECURITY_WINDOWS.map((days) => (
            <Link
              key={days}
              href={hrefWith(filter, { days, page: undefined })}
              aria-current={filter.days === days ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium transition-colors ${
                filter.days === days ? "bg-[var(--nav-bg)] text-white" : "text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-text)]"
              }`}
            >
              {WINDOW_LABEL[days]}
            </Link>
          ))}
        </nav>
      </PageHero>

      {/* ---------- สถานะระบบ ---------- */}
      <section aria-labelledby="system-heading" className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="system-heading" className="flex items-center gap-2 text-base font-semibold">
            <AppIcon name="activity" size={18} className="text-[var(--primary)]" /> สถานะระบบ
            <StatusBadge tone={CHECK_BADGE[overall]}>{CHECK_LABEL[overall]}</StatusBadge>
          </h2>
          <p className="text-xs text-[var(--muted)]">
            แอปทำงานต่อเนื่อง {uptimeText(system.uptimeSeconds)} · ตรวจเมื่อ {formatThaiDateTime(now)} ·{" "}
            <a href={withBasePath("/api/health/")} className="font-medium text-[var(--primary-text)] hover:underline" target="_blank" rel="noreferrer">/api/health/</a>
          </p>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {checks.map((check) => (
            <li key={check.key} className="rounded-xl border border-[var(--line)] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{check.label}</span>
                <StatusBadge tone={CHECK_BADGE[check.status]} className="shrink-0 text-[10px]">{CHECK_LABEL[check.status]}</StatusBadge>
              </div>
              <p className="mt-1.5 break-words text-xs text-[var(--muted)]">{check.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          ระบบเฝ้าดู (stn-atacs-watchdog) ตรวจ <code>/api/health/</code> ทุก 1 นาที ล่มติดกัน 3 ครั้งจะแจ้ง Telegram เตือนซ้ำทุก 30 นาที และแจ้งเมื่อกลับมาใช้งานได้
        </p>
      </section>

      <SessionsPanel
        sessions={sessionList.sessions}
        tracked={sessionList.tracked}
        geo={sessionGeo}
        notice={one("sessnotice")}
        error={one("sesserror")}
        nowMs={now.getTime()}
      />

      <LoginMethodsPanel state={passwordLogin} coverage={coverage} notice={one("notice")} error={one("pwerror")} />

      {loadError && (
        <div role="alert" className="rounded-xl border border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] px-4 py-3 text-sm text-[var(--state-warning-fg)]">{loadError}</div>
      )}

      {data && (
        <>
          {/* ---------- KPI ---------- */}
          <section aria-label={`สรุป ${windowLabel}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard icon="user" image="office-desk" label={`เข้าสู่ระบบสำเร็จ (${windowLabel})`} value={n(data.kpi.loginSuccess)} tone="success" />
            <SummaryCard icon="key" image="meeting-room" label="รหัสผ่านไม่ถูกต้อง" value={n(data.kpi.loginFailed)} tone={data.kpi.loginFailed ? "warning" : "neutral"} />
            <SummaryCard icon="shield" image="it-storage" label="ถูกล็อกชั่วคราว" value={n(data.kpi.lockouts)} tone={data.kpi.lockouts ? "danger" : "neutral"} />
            <SummaryCard
              icon="warning"
              image="office-desk"
              label="เหตุการณ์น่าสงสัยทั้งหมด"
              value={n(data.kpi.suspicious)}
              hint={`จาก ${n(data.ips.length)}${data.ips.length >= 10 ? "+" : ""} IP`}
              tone={data.kpi.suspicious ? "danger" : "neutral"}
            />
          </section>

          {/* ---------- กราฟ 30 วัน ---------- */}
          <section aria-labelledby="chart-heading" className="glass-panel rounded-2xl p-5">
            <h2 id="chart-heading" className="text-base font-semibold">เหตุการณ์รายวัน (30 วันล่าสุด)</h2>
            <DailyChart series={data.series} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* ---------- IP ที่น่าสงสัย ---------- */}
            <section aria-labelledby="ip-heading" className="glass-panel min-w-0 overflow-hidden rounded-2xl">
              <div className="border-b border-[var(--line)] px-5 py-3">
                <h2 id="ip-heading" className="text-base font-semibold">IP ที่มีเหตุการณ์น่าสงสัยมากที่สุด ({windowLabel})</h2>
              </div>
              {data.ips.length === 0 ? (
                <EmptyState icon="shield" title="ไม่พบ IP ที่น่าสงสัย" description={`ไม่มีเหตุการณ์น่าสงสัยในช่วง ${windowLabel}`} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">IP / ตำแหน่ง</th>
                        <th className="px-4 py-2.5 text-right font-medium">ครั้ง</th>
                        <th className="px-4 py-2.5 font-medium">เหตุการณ์ / บัญชีที่ลอง</th>
                        <th className="px-4 py-2.5 font-medium">ล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ips.map((item) => (
                        <tr key={item.ip} className="border-t border-[var(--line)] align-top">
                          <td className="px-4 py-2.5">
                            <IpLocation ip={item.ip} geo={data.geo.get(item.ip)} href={hrefWith(filter, { ip: item.ip, page: undefined })} />
                            {item.succeeded > 0 && (
                              <StatusBadge tone="warning" className="mt-1 block w-fit text-[10px]">เข้าสู่ระบบสำเร็จ {n(item.succeeded)} ครั้ง</StatusBadge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{n(item.total)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {item.kinds.map((kind) => {
                                const info = describeSecurityEvent(kind);
                                return <StatusBadge key={kind} tone={TONE_BADGE[info.tone]} className="text-[10px]">{info.label}</StatusBadge>;
                              })}
                            </div>
                            {item.identities.length > 0 && <p className="mt-1 break-all text-xs text-[var(--muted)]">{item.identities.join(", ")}</p>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--muted)]">{formatThaiDateTime(item.lastSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ---------- ประเภทเหตุการณ์ ---------- */}
            <section aria-labelledby="type-heading" className="glass-panel min-w-0 rounded-2xl">
              <div className="border-b border-[var(--line)] px-5 py-3">
                <h2 id="type-heading" className="text-base font-semibold">ประเภทเหตุการณ์ ({windowLabel})</h2>
              </div>
              {data.byType.length === 0 ? (
                <EmptyState icon="shield" title="ยังไม่มีเหตุการณ์" description={`ไม่มีบันทึกในช่วง ${windowLabel}`} />
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {data.byType.map((row) => {
                    const info = describeSecurityEvent(row.eventType);
                    return (
                      <li key={row.eventType}>
                        <Link
                          href={hrefWith(filter, { type: row.eventType, group: undefined, page: undefined })}
                          className="flex min-h-11 items-center justify-between gap-3 px-5 py-2 text-sm hover:bg-[var(--primary-soft)]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${info.tone === "danger" ? "bg-red-500" : info.tone === "warning" ? "bg-amber-500" : info.tone === "success" ? "bg-emerald-500" : "bg-sky-500"}`} aria-hidden="true" />
                            <span className="truncate">{info.label}</span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                            <b className="text-sm text-[var(--foreground)]">{n(row.total)}</b> · {n(row.ips ?? 0)} IP
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* ---------- บันทึกเหตุการณ์ ---------- */}
          <section aria-labelledby="events-heading" className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--line)] px-5 py-3">
              <h2 id="events-heading" className="text-base font-semibold">บันทึกเหตุการณ์</h2>
            </div>
            <form method="GET" action={withBasePath("/admin/security/")} className="grid gap-2 border-b border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
              {filter.days !== 7 && <input type="hidden" name="days" value={filter.days} />}
              {filter.type && <input type="hidden" name="type" value={filter.type} />}
              <select name="group" aria-label="หมวดเหตุการณ์" defaultValue={filter.group ?? ""} className="filter-control">
                <option value="">ทุกหมวด</option>
                {SECURITY_EVENT_GROUPS.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
              </select>
              <input name="ip" aria-label="IP" defaultValue={filter.ip ?? ""} placeholder="IP เช่น 203.150.12.9" className="filter-control font-mono" inputMode="decimal" />
              <div className="relative">
                <AppIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input name="search" type="search" aria-label="ค้นหา" defaultValue={filter.search ?? ""} placeholder="ชื่อผู้ใช้ / รายละเอียด / path" className="filter-control pl-9" />
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" className="primary-action action-sm gap-1.5"><AppIcon name="filter" size={15} /> กรอง</button>
                {hasEventFilter && <Link href={hrefWith({ days: filter.days }, {})} className="px-2 text-sm text-[var(--muted)] hover:underline">ล้าง</Link>}
              </div>
              {filter.type && (
                <p className="text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-4">
                  ประเภท: <b>{describeSecurityEvent(filter.type).label}</b>{" "}
                  <Link href={hrefWith(filter, { type: undefined, page: undefined })} className="text-[var(--primary-text)] hover:underline">× ล้างประเภท</Link>
                </p>
              )}
            </form>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">เวลา</th>
                    <th className="px-4 py-2.5 font-medium">เหตุการณ์</th>
                    <th className="px-4 py-2.5 font-medium">IP / ตำแหน่ง</th>
                    <th className="px-4 py-2.5 font-medium">ผู้ใช้ / รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">ไม่พบเหตุการณ์ตามเงื่อนไข</td>
                    </tr>
                  ) : (
                    data.events.rows.map((event) => {
                      const info = describeSecurityEvent(event.eventType);
                      return (
                        <tr key={event.id} className="border-t border-[var(--line)] align-top">
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--muted)]">{formatThaiDateTime(event.createdAt)}</td>
                          <td className="px-4 py-2.5"><StatusBadge tone={TONE_BADGE[info.tone]} className="text-[11px]">{info.label}</StatusBadge></td>
                          <td className="px-4 py-2.5">
                            <IpLocation ip={event.ip} geo={data.geo.get(event.ip)} href={hrefWith(filter, { ip: event.ip, page: undefined })} compact />
                          </td>
                          <td className="px-4 py-2.5">
                            {event.identity && <p className="font-medium">{event.identity}</p>}
                            {event.detail && <p className="break-words text-xs text-[var(--muted)]">{event.detail}</p>}
                            {event.path && <p className="break-all font-mono text-[11px] text-[var(--muted)]">{event.path}</p>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={data.events.page}
              totalPages={data.events.totalPages}
              total={data.events.total}
              start={data.events.total ? (data.events.page - 1) * data.events.pageSize + 1 : 0}
              end={(data.events.page - 1) * data.events.pageSize + data.events.rows.length}
              hrefFor={(target) => hrefWith(filter, { page: target })}
              label="แบ่งหน้าบันทึกเหตุการณ์"
              className="border-t border-[var(--line)]"
            />
          </section>
        </>
      )}
    </div>
  );
}
