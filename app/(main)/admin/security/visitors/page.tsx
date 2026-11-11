import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, PageHero, SettingsBreadcrumb, SummaryCard } from "@/app/(main)/admin/_components/page-hero";
import { TablePagination } from "@/app/_components/ui/data-table";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { formatThaiDateTime } from "@/lib/date-format";
import { isMissingSchemaError } from "@/lib/schema-errors";
import { geoLookupUrl, locationLabel, visitorLogRetentionDays } from "@/lib/visitor-log";
import {
  ensureIpGeoInBackground,
  geoForIps,
  recentVisits,
  topPages,
  visitorKpis,
  visitsByIp,
  visitsByLocation,
  type VisitorFilter,
} from "@/lib/visitor-log-data";

import { IpLocation } from "../_components/ip-location";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const WINDOWS = [1, 7, 30, 90] as const;
const WINDOW_LABEL: Record<number, string> = { 1: "24 ชั่วโมง", 7: "7 วัน", 30: "30 วัน", 90: "90 วัน" };
const DEVICE_LABEL: Record<string, string> = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์", other: "อื่น ๆ" };
const n = (value: number) => value.toLocaleString("th-TH");
const one = (value: string | string[] | undefined) => ((Array.isArray(value) ? value[0] : value) ?? "").trim();

function readFilter(params: Record<string, string | string[] | undefined>): VisitorFilter {
  const days = Number(one(params.days));
  const area = one(params.area);
  const ip = one(params.ip);
  const search = one(params.search).slice(0, 100);
  return {
    days: (WINDOWS as readonly number[]).includes(days) ? days : 7,
    ...(area === "public" || area === "staff" ? { area } : {}),
    ...(/^[0-9a-fA-F:.]{2,45}$/.test(ip) ? { ip } : {}),
    ...(one(params.user) === "1" ? { loggedIn: true } : {}),
    ...(one(params.bots) === "1" ? { includeBots: true } : {}),
    ...(search ? { search } : {}),
  };
}

function hrefWith(filter: VisitorFilter, patch: Record<string, string | number | boolean | undefined>) {
  const merged: Record<string, unknown> = {
    days: filter.days,
    area: filter.area,
    ip: filter.ip,
    user: filter.loggedIn ? "1" : undefined,
    bots: filter.includeBots ? "1" : undefined,
    search: filter.search,
    ...patch,
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || value === false || (key === "days" && value === 7) || (key === "page" && Number(value) <= 1)) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `/admin/security/visitors/?${text}` : "/admin/security/visitors/";
}

export default async function VisitorsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const filter = readFilter(params);
  const page = Number(one(params.page)) || 1;
  const lookupEnabled = Boolean(geoLookupUrl("8.8.8.8"));

  let loadError = "";
  let data: {
    kpi: Awaited<ReturnType<typeof visitorKpis>>;
    locations: Awaited<ReturnType<typeof visitsByLocation>>;
    ips: Awaited<ReturnType<typeof visitsByIp>>;
    visits: Awaited<ReturnType<typeof recentVisits>>;
    pages: Awaited<ReturnType<typeof topPages>>;
    geo: Awaited<ReturnType<typeof geoForIps>>;
  } | null = null;
  try {
    const [kpi, locations, ips, visits, pages] = await Promise.all([
      visitorKpis(filter),
      visitsByLocation(filter),
      visitsByIp(filter, page),
      recentVisits(filter, 40),
      topPages(filter),
    ]);
    const allIps = [...ips.ips.map((row) => row.ip), ...visits.map((row) => row.ip)];
    const geo = await geoForIps(allIps);
    // IPs not resolved yet are looked up in the background; they show on the next load.
    ensureIpGeoInBackground(allIps.filter((ip) => !geo.has(ip)));
    data = { kpi, locations, ips, visits, pages, geo };
  } catch (error) {
    console.error("[admin/security/visitors] load failed", error);
    loadError = isMissingSchemaError(error)
      ? "ยังไม่มีตารางบันทึกผู้เข้าชม กรุณารัน database/add_visitor_access_log.sql"
      : "โหลดข้อมูลผู้เข้าชมไม่สำเร็จ กรุณารีเฟรชหน้านี้";
  }

  const maxLocation = Math.max(1, ...(data?.locations.map((row) => row.visits) ?? [1]));
  const hasFilter = Boolean(filter.area || filter.ip || filter.loggedIn || filter.search || filter.includeBots);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <SettingsBreadcrumb current="ผู้เข้าใช้งานและตำแหน่ง IP" parent={{ href: "/admin/security", label: "ความปลอดภัยระบบ" }} />
      <PageHero
        icon="globe"
        image="meeting-room"
        title="ผู้เข้าใช้งานและตำแหน่ง IP"
        description={`ทุกการเปิดหน้าเว็บ (ทั้งประชาชนและเจ้าหน้าที่) พร้อมตำแหน่งโดยประมาณของ IP · เก็บ ${n(visitorLogRetentionDays())} วัน`}
      >
        <nav aria-label="ช่วงเวลา" className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
          {WINDOWS.map((days) => (
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

      {!lookupEnabled && (
        <p className="rounded-xl border border-[var(--state-info-border)] bg-[var(--state-info-bg)] px-4 py-3 text-sm text-[var(--state-info-fg)]">
          ยังไม่ได้เปิดการค้นหาตำแหน่งจาก IP — ตั้ง <code>VISITOR_GEO_LOOKUP_URL=https://ipwho.is/{"{ip}"}</code> ให้ container (แบบเดียวกับ stn-eoc) ตอนนี้แสดงได้เฉพาะ IP และแยกเครือข่ายภายใน
        </p>
      )}
      {loadError && <div role="alert" className="rounded-xl border border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] px-4 py-3 text-sm text-[var(--state-warning-fg)]">{loadError}</div>}

      {data && (
        <>
          <section aria-label="สรุป" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard icon="eye" image="office-desk" label={`การเปิดหน้า (${WINDOW_LABEL[filter.days]})`} value={n(data.kpi.visits)} hint={`ประชาชน ${n(data.kpi.publicVisits)} · เจ้าหน้าที่ ${n(data.kpi.staffVisits)}`} />
            <SummaryCard icon="globe" image="meeting-room" label="IP ไม่ซ้ำ" value={n(data.kpi.ips)} hint={`เครือข่ายภายใน ${n(data.kpi.privateIps)} IP`} tone="info" />
            <SummaryCard icon="users" image="it-storage" label="ผู้ใช้ที่เข้าสู่ระบบ" value={n(data.kpi.users)} tone="success" />
            <SummaryCard icon="warning" image="office-desk" label="IP จากต่างประเทศ" value={n(data.kpi.foreignIps)} tone={data.kpi.foreignIps ? "danger" : "neutral"} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-labelledby="loc-heading" className="glass-panel min-w-0 rounded-2xl">
              <div className="border-b border-[var(--line)] px-5 py-3">
                <h2 id="loc-heading" className="text-base font-semibold">เข้ามาจากที่ไหน</h2>
                <p className="text-xs text-[var(--muted)]">ตำแหน่งจาก IP เป็นค่าประมาณระดับจังหวัด เน็ตมือถือมักแสดงเป็นกรุงเทพฯ</p>
              </div>
              {data.locations.length === 0 ? (
                <EmptyState icon="globe" title="ยังไม่มีผู้เข้าชม" description={`ไม่มีการเปิดหน้าในช่วง ${WINDOW_LABEL[filter.days]}`} />
              ) : (
                <ul className="space-y-2.5 p-5">
                  {data.locations.map((row, index) => {
                    const label = row.network === null ? "ยังไม่ได้ค้นหาตำแหน่ง" : locationLabel(row);
                    const foreign = row.network === "public" && row.country && row.country !== "TH";
                    return (
                      <li key={`${row.network}-${row.country}-${row.region}-${index}`}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className={`min-w-0 truncate ${foreign ? "font-semibold text-[var(--state-danger-fg)]" : ""}`}>{label}</span>
                          <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                            <b className="text-sm text-[var(--foreground)]">{n(row.visits)}</b> ครั้ง · {n(row.ips)} IP{row.users ? ` · ${n(row.users)} ผู้ใช้` : ""}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5" aria-hidden="true">
                          <div
                            className={`h-full rounded-full ${foreign ? "bg-red-500" : row.network === "private" ? "bg-slate-400" : "bg-[var(--brand-green)]"}`}
                            style={{ width: `${(row.visits / maxLocation) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="pages-heading" className="glass-panel min-w-0 rounded-2xl">
              <div className="border-b border-[var(--line)] px-5 py-3">
                <h2 id="pages-heading" className="text-base font-semibold">หน้าที่เปิดมากที่สุด</h2>
              </div>
              {data.pages.length === 0 ? (
                <EmptyState icon="file-text" title="ยังไม่มีข้อมูล" description="" />
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {data.pages.map((row) => (
                    <li key={row.path} className="flex min-h-10 items-center justify-between gap-3 px-5 py-2 text-sm">
                      <span className="min-w-0 truncate font-mono text-xs">{row.path}</span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]"><b className="text-sm text-[var(--foreground)]">{n(row.visits)}</b> · {n(row.ips)} IP</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <form method="GET" action={withBasePath("/admin/security/visitors/")} className="glass-panel grid gap-2 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
            {filter.days !== 7 && <input type="hidden" name="days" value={filter.days} />}
            <select name="area" aria-label="ส่วนของเว็บ" defaultValue={filter.area ?? ""} className="filter-control">
              <option value="">ทุกส่วน</option>
              <option value="public">หน้าสาธารณะ</option>
              <option value="staff">หน้าเจ้าหน้าที่</option>
            </select>
            <input name="ip" aria-label="IP" defaultValue={filter.ip ?? ""} placeholder="IP" className="filter-control font-mono" inputMode="decimal" />
            <div className="relative">
              <AppIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input name="search" type="search" aria-label="ค้นหา" defaultValue={filter.search ?? ""} placeholder="ชื่อผู้ใช้ / จังหวัด / เมือง / ผู้ให้บริการ / หน้า" className="filter-control pl-9" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="user" value="1" defaultChecked={filter.loggedIn} /> เฉพาะผู้ที่เข้าสู่ระบบ</label>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="bots" value="1" defaultChecked={filter.includeBots} /> รวมบอท</label>
              <button type="submit" className="primary-action action-sm gap-1.5"><AppIcon name="filter" size={15} /> กรอง</button>
              {hasFilter && <Link href={hrefWith({ days: filter.days }, {})} className="text-sm text-[var(--muted)] hover:underline">ล้าง</Link>}
            </div>
          </form>

          <section aria-labelledby="ips-heading" className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--line)] px-5 py-3">
              <h2 id="ips-heading" className="text-base font-semibold">IP ที่เข้าใช้งาน ({n(data.ips.total)} IP)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">IP / ตำแหน่ง / ผู้ให้บริการ</th>
                    <th className="px-4 py-2.5 text-right font-medium">ครั้ง</th>
                    <th className="px-4 py-2.5 font-medium">ผู้ใช้</th>
                    <th className="px-4 py-2.5 font-medium">อุปกรณ์</th>
                    <th className="px-4 py-2.5 font-medium">ครั้งแรก – ล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ips.ips.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">ไม่พบข้อมูลตามเงื่อนไข</td></tr>
                  ) : (
                    data.ips.ips.map((row) => (
                      <tr key={row.ip} className="border-t border-[var(--line)] align-top">
                        <td className="px-4 py-2.5"><IpLocation ip={row.ip} geo={data.geo.get(row.ip)} href={hrefWith(filter, { ip: row.ip, page: undefined })} /></td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{n(row.visits)}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {row.users.length ? row.users.join(", ") : <span className="text-[var(--muted)]">ไม่ได้เข้าสู่ระบบ</span>}
                          <div className="mt-1 flex gap-1">
                            {row.areas.map((area) => <StatusBadge key={area} tone={area === "staff" ? "info" : "neutral"} className="text-[10px]">{area === "staff" ? "เจ้าหน้าที่" : "สาธารณะ"}</StatusBadge>)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.devices.map((device) => DEVICE_LABEL[device] ?? device).join(", ")}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--muted)]">
                          {formatThaiDateTime(row.firstSeen)}
                          <span className="block">{formatThaiDateTime(row.lastSeen)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={data.ips.page}
              totalPages={data.ips.totalPages}
              total={data.ips.total}
              start={data.ips.total ? (data.ips.page - 1) * data.ips.pageSize + 1 : 0}
              end={(data.ips.page - 1) * data.ips.pageSize + data.ips.ips.length}
              hrefFor={(target) => hrefWith(filter, { page: target })}
              label="แบ่งหน้ารายการ IP"
              className="border-t border-[var(--line)]"
            />
          </section>

          <section aria-labelledby="recent-heading" className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--line)] px-5 py-3">
              <h2 id="recent-heading" className="text-base font-semibold">การเปิดหน้าล่าสุด</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">เวลา</th>
                    <th className="px-4 py-2.5 font-medium">IP / ตำแหน่ง</th>
                    <th className="px-4 py-2.5 font-medium">หน้า</th>
                    <th className="px-4 py-2.5 font-medium">ผู้ใช้ / อุปกรณ์</th>
                  </tr>
                </thead>
                <tbody>
                  {data.visits.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--line)] align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--muted)]">{formatThaiDateTime(row.visitedAt)}</td>
                      <td className="px-4 py-2.5"><IpLocation ip={row.ip} geo={data.geo.get(row.ip)} href={hrefWith(filter, { ip: row.ip, page: undefined })} compact /></td>
                      <td className="px-4 py-2.5">
                        <span className="break-all font-mono text-xs">{row.path}</span>
                        {row.referrer && <span className="block text-[11px] text-[var(--muted)]">มาจาก {row.referrer}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {row.userName ?? <span className="text-[var(--muted)]">ผู้เยี่ยมชม</span>}
                        <span className="block text-[var(--muted)]">{[DEVICE_LABEL[row.device ?? ""] ?? row.device, row.browser].filter(Boolean).join(" · ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
