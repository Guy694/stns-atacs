import Link from "next/link";

import { TopNavigation } from "@/app/_components/top-navigation";
import { listAssets } from "@/lib/assets";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sp(params: Record<string, string | string[] | undefined>, key: string) {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-amber-100 text-amber-700",
  Broken: "bg-rose-100 text-rose-700",
};
const STATUS_LABEL: Record<string, string> = {
  Active: "ใช้งานอยู่",
  Inactive: "ไม่ใช้งาน",
  Broken: "ชำรุด",
};

const ALL_DISTRICTS = ["เมืองสตูล", "ควนกาหลง", "ควนโดน", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"] as const;

function PctBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default async function PublicDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = sp(params, "q");
  const districtFilter = sp(params, "district");
  const groupFilter = sp(params, "group"); // "Hardware" | "Software" | ""
  const requestedView = sp(params, "view");
  const view = requestedView === "facilities" ? "facilities" : "overview";

  // ── Load all assets (server-only, no IP/serial exposed to client) ────────
  const allAssets = await listAssets();

  // ── Search results (public-safe fields only) ─────────────────────────────
  let searchResults: { assetName: string; assetRegistrationNo: string; deviceType: string; assetGroup: string; facilityName: string; districtName: string; currentStatus: string }[] = [];
  if (q.length >= 2) {
    const found = await listAssets({ search: q });
    searchResults = found.slice(0, 20).map((a) => ({
      assetName: a.assetName,
      assetRegistrationNo: a.assetRegistrationNo,
      deviceType: a.deviceType,
      assetGroup: a.assetGroup,
      facilityName: a.facilityName,
      districtName: a.districtName,
      currentStatus: a.currentStatus,
    }));
  }

  // ── District list for filter ─────────────────────────────────────────────
  const allDistricts = [...ALL_DISTRICTS];
  const shownDistricts = districtFilter ? allDistricts.filter((d) => d === districtFilter) : allDistricts;

  // ── Apply filters ────────────────────────────────────────────────────────
  let filtered = allAssets;
  if (districtFilter) filtered = filtered.filter((a) => a.districtName === districtFilter);
  if (groupFilter) filtered = filtered.filter((a) => a.assetGroup === groupFilter);

  const total = filtered.length;
  const active = filtered.filter((a) => a.currentStatus === "Active").length;
  const broken = filtered.filter((a) => a.currentStatus === "Broken").length;
  const inactive = filtered.filter((a) => a.currentStatus === "Inactive").length;
  const hw = filtered.filter((a) => a.assetGroup === "Hardware").length;
  const sw = filtered.filter((a) => a.assetGroup === "Software").length;
  const facilityCount = new Set(filtered.map((a) => a.facilityId)).size;
  const districtCount = shownDistricts.length;
  const safeTotal = Math.max(total, 1);
  const activeRate = Math.round((active / safeTotal) * 100);

  // ── By district aggregation ──────────────────────────────────────────────
  const districtSummary = filtered.reduce<Record<string, { name: string; total: number; active: number; broken: number; inactive: number; facilities: Set<number> }>>(
    (acc, a) => {
      if (!acc[a.districtName]) acc[a.districtName] = { name: a.districtName, total: 0, active: 0, broken: 0, inactive: 0, facilities: new Set() };
      acc[a.districtName].total++;
      acc[a.districtName].facilities.add(a.facilityId);
      if (a.currentStatus === "Active") acc[a.districtName].active++;
      if (a.currentStatus === "Broken") acc[a.districtName].broken++;
      if (a.currentStatus === "Inactive") acc[a.districtName].inactive++;
      return acc;
    },
    {}
  );

  const byDistrict = shownDistricts
    .map((name) => {
      const summary = districtSummary[name];
      if (!summary) {
        return { name, total: 0, active: 0, broken: 0, inactive: 0, facilityCount: 0 };
      }
      return {
        name,
        total: summary.total,
        active: summary.active,
        broken: summary.broken,
        inactive: summary.inactive,
        facilityCount: summary.facilities.size,
      };
    })
    .sort((a, b) => b.total - a.total);

  // ── By facility aggregation ──────────────────────────────────────────────
  const byFacility = Object.values(
    filtered.reduce<Record<number, { id: number; name: string; district: string; total: number; active: number; broken: number; inactive: number }>>(
      (acc, a) => {
        if (!acc[a.facilityId]) acc[a.facilityId] = { id: a.facilityId, name: a.facilityName, district: a.districtName, total: 0, active: 0, broken: 0, inactive: 0 };
        acc[a.facilityId].total++;
        if (a.currentStatus === "Active") acc[a.facilityId].active++;
        if (a.currentStatus === "Broken") acc[a.facilityId].broken++;
        if (a.currentStatus === "Inactive") acc[a.facilityId].inactive++;
        return acc;
      }, {}
    )
  ).sort((a, b) => b.total - a.total);

  // ── By device type ───────────────────────────────────────────────────────
  const byType = Object.entries(
    filtered.reduce<Record<string, { total: number; active: number; broken: number; inactive: number }>>((acc, a) => {
      const k = a.deviceType || a.assetGroup;
      if (!acc[k]) acc[k] = { total: 0, active: 0, broken: 0, inactive: 0 };
      acc[k].total++;
      if (a.currentStatus === "Active") acc[k].active++;
      if (a.currentStatus === "Broken") acc[k].broken++;
      if (a.currentStatus === "Inactive") acc[k].inactive++;
      return acc;
    }, {})
  ).map(([type, c]) => ({ type, ...c })).sort((a, b) => b.total - a.total);

  const maxType = byType[0]?.total ?? 1;
  const maxDistrict = byDistrict[0]?.total ?? 1;

  // CSS conic-gradient for status donut
  const activePct = (active / safeTotal) * 100;
  const brokenPct = (broken / safeTotal) * 100;
  const donutGradient = `conic-gradient(#10b981 0% ${activePct.toFixed(1)}%, #ef4444 ${activePct.toFixed(1)}% ${(activePct + brokenPct).toFixed(1)}%, #f59e0b ${(activePct + brokenPct).toFixed(1)}% 100%)`;

  function filterHref(changes: Record<string, string>) {
    const next = { district: districtFilter, group: groupFilter, view, q, ...changes };
    const parts = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return `/public${parts.length ? "?" + parts.join("&") : ""}`;
  }

  function tabClass(v: string) {
    return `rounded-xl px-4 py-2 text-sm font-medium transition ${view === v ? "bg-indigo-600 text-white shadow" : "bg-white/70 text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <TopNavigation current="public" user={null} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#4c1d95_0%,#5b21b6_40%,#4338ca_80%,#3b82f6_100%)] px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-emerald-300/10 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-[0.2em] text-white/80 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ATACS · PUBLIC DASHBOARD · จ.สตูล
            </div>
            <h1 className="section-title mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              ทะเบียนทรัพย์สิน<br className="hidden sm:block" />สารสนเทศ จ.สตูล
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-white">
              ข้อมูลสรุประดับจังหวัดและอำเภอ — ไม่เปิดเผย IP, Serial, ผู้รับผิดชอบ และตำแหน่งติดตั้ง
            </p>
          </div>
          {/* Active ring */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - activeRate / 100)}`} />
              </svg>
              <div className="z-10 text-center">
                <p className="text-3xl font-semibold">{activeRate}%</p>
                <p className="text-[11px] text-white">Active</p>
              </div>
            </div>
            <p className="text-xs text-white">{active} / {total} รายการ</p>
          </div>
        </div>

        {/* KPI row */}
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { label: "ทรัพย์สินรวม", value: total },
            { label: "พร้อมใช้งาน", value: active, accent: true },
            { label: "ชำรุด", value: broken, warn: broken > 0 },
            { label: "ไม่ใช้งาน", value: inactive },
            { label: "Hardware", value: hw },
            { label: "Software", value: sw },
            { label: "หน่วยงาน", value: facilityCount },
            { label: "อำเภอ", value: districtCount },
          ].map((k) => (
            <div key={k.label} className={`rounded-xl border px-3 py-3 backdrop-blur-sm ${
              k.accent ? "border-white/30 bg-white/20" :
              k.warn ? "border-rose-300/30 bg-rose-500/15" :
              "border-white/15 bg-white/10"
            }`}>
              <p className="text-[10px] text-white">{k.label}</p>
              <p className="mt-1.5 text-2xl font-semibold">{k.value}</p>
            </div>
          ))}
        </div>
        {districtFilter && (
          <div className="relative mt-3 flex items-center gap-2 text-xs text-white/60">
            <span>กรองข้อมูล: อำเภอ {districtFilter}</span>
            <Link href="/public" className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20">✕ ล้างตัวกรอง</Link>
          </div>
        )}
      </section>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ค้นหาสาธารณะ</p>
            <p className="mt-0.5 text-sm font-semibold">ค้นหาจากเลขครุภัณฑ์ / ชื่ออุปกรณ์</p>
          </div>
        </div>
        <form method="GET" action="/public" className="mt-3 flex gap-3">
          <input type="hidden" name="district" value={districtFilter} />
          <input type="hidden" name="group" value={groupFilter} />
          <input type="hidden" name="view" value={view} />
          <input type="search" name="q" defaultValue={q}
            placeholder="เลขครุภัณฑ์, ชื่ออุปกรณ์, ประเภท…"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          <button type="submit" className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">ค้นหา</button>
        </form>

        {q.length >= 2 && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ไม่พบทรัพย์สินที่ตรงกับ &ldquo;{q}&rdquo;</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-[var(--muted)]">พบ {searchResults.length} รายการ{searchResults.length === 20 ? " (สูงสุด 20)" : ""}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/6 text-xs text-[var(--muted)]">
                        <th className="pb-2 pr-4 text-left font-medium">เลขครุภัณฑ์</th>
                        <th className="pb-2 pr-4 text-left font-medium">ชื่ออุปกรณ์</th>
                        <th className="pb-2 pr-4 text-left font-medium">ประเภท</th>
                        <th className="pb-2 pr-4 text-left font-medium">หน่วยงาน</th>
                        <th className="pb-2 text-center font-medium">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/4">
                      {searchResults.map((a) => (
                        <tr key={a.assetRegistrationNo} className="hover:bg-white/50">
                          <td className="py-2.5 pr-4 font-mono text-xs">{a.assetRegistrationNo}</td>
                          <td className="py-2.5 pr-4 font-medium">{a.assetName}</td>
                          <td className="py-2.5 pr-4"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{a.deviceType || a.assetGroup}</span></td>
                          <td className="py-2.5 pr-4 text-[var(--muted)]">{a.facilityName}</td>
                          <td className="py-2.5 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[a.currentStatus] ?? ""}`}>
                              {STATUS_LABEL[a.currentStatus] ?? a.currentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
        {q.length > 0 && q.length < 2 && <p className="mt-3 text-xs text-[var(--muted)]">กรุณาป้อนอย่างน้อย 2 ตัวอักษร</p>}
      </section>

      {/* ── Filter + Tabs ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* District filter */}
        <form method="GET" action="/public" className="flex items-center gap-2">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="group" value={groupFilter} />
          <input type="hidden" name="q" value={q} />
          <select name="district" defaultValue={districtFilter}
            onChange={undefined}
            className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-indigo-400">
            <option value="">ทุกอำเภอ</option>
            {allDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="submit" className="rounded-xl bg-white/80 border border-[var(--line)] px-3 py-2 text-sm hover:bg-white">กรอง</button>
        </form>

        {/* Asset group filter */}
        <div className="flex gap-1.5">
          {[["", "ทั้งหมด"], ["Hardware", "Hardware"], ["Software", "Software"]].map(([val, label]) => (
            <Link key={val} href={filterHref({ group: val })}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${groupFilter === val ? "bg-indigo-600 text-white" : "bg-white/70 text-[var(--muted)] hover:bg-white"}`}>
              {label}
            </Link>
          ))}
        </div>

        {/* View tabs */}
        <div className="ml-auto flex gap-1.5">
          <Link href={filterHref({ view: "overview" })} className={tabClass("overview")}>ภาพรวม</Link>
          <Link href={filterHref({ view: "facilities" })} className={tabClass("facilities")}>รายหน่วยงาน</Link>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: OVERVIEW */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === "overview" && (
        <>
          {/* Status donut + breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Donut chart */}
            <div className="glass-panel rounded-2xl p-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">สถานะทรัพย์สิน</p>
              <h2 className="section-title mt-1 text-xl font-semibold">สัดส่วนสถานะทรัพย์สินสารสนเทศ</h2>
              <div className="mt-5 flex items-center gap-6">
                {/* donut */}
                <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
                  <div className="h-full w-full rounded-full" style={{ background: donutGradient }} />
                  <div className="absolute inset-0 m-auto flex h-[100px] w-[100px] flex-col items-center justify-center rounded-full bg-white shadow-sm">
                    <p className="text-2xl font-bold text-indigo-700">{activeRate}%</p>
                    <p className="text-[10px] text-[var(--muted)]">Active</p>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex flex-col gap-4 text-sm">
                  {[
                    { label: "พร้อมใช้งาน", count: active, color: "bg-emerald-500", pct: Math.round((active / safeTotal) * 100) },
                    { label: "ชำรุด", count: broken, color: "bg-rose-500", pct: Math.round((broken / safeTotal) * 100) },
                    { label: "ไม่ใช้งาน", count: inactive, color: "bg-amber-400", pct: Math.round((inactive / safeTotal) * 100) },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 shrink-0 rounded-full ${s.color}`} />
                      <div>
                        <p className="font-medium">{s.label}</p>
                        <p className="text-xs text-[var(--muted)]">{s.count} รายการ · {s.pct}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* HW/SW + status bars */}
            <div className="glass-panel rounded-2xl p-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">สัดส่วน Hardware / Software</p>
              <h2 className="section-title mt-1 text-xl font-semibold">Asset Mix</h2>
              {/* stacked bar */}
              <div className="mt-5 flex h-8 overflow-hidden rounded-xl text-xs font-semibold text-white">
                <div className="flex items-center justify-center bg-indigo-600" style={{ width: `${Math.round((hw / safeTotal) * 100)}%` }}>
                  {hw > 0 && `${Math.round((hw / safeTotal) * 100)}%`}
                </div>
                <div className="flex flex-1 items-center justify-center bg-emerald-400 text-emerald-900">
                  {sw > 0 && `${Math.round((sw / safeTotal) * 100)}%`}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-indigo-50 p-4">
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /><span className="text-xs text-[var(--muted)]">Hardware</span></div>
                  <p className="mt-2 text-2xl font-bold text-indigo-700">{hw}</p>
                  <p className="text-xs text-[var(--muted)]">{Math.round((hw / safeTotal) * 100)}% ของทั้งหมด</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-[var(--muted)]">Software</span></div>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">{sw}</p>
                  <p className="text-xs text-[var(--muted)]">{Math.round((sw / safeTotal) * 100)}% ของทั้งหมด</p>
                </div>
              </div>
              {/* status quick bars */}
              <div className="mt-4 space-y-3 border-t border-black/6 pt-4">
                {[
                  { label: "พร้อมใช้งาน", value: active, color: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
                  { label: "ชำรุด", value: broken, color: "bg-rose-500", badge: "bg-rose-100 text-rose-700" },
                  { label: "ไม่ใช้งาน", value: inactive, color: "bg-amber-400", badge: "bg-amber-100 text-amber-700" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span>{s.label}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${s.badge}`}>{s.value} ({Math.round((s.value / safeTotal) * 100)}%)</span>
                    </div>
                    <PctBar value={s.value} max={total} color={s.color} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* District comparison */}
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/6 px-5 py-3">
              <h2 className="font-semibold">เปรียบเทียบรายอำเภอ</h2>
              <span className="text-xs text-[var(--muted)]">{byDistrict.length} อำเภอ</span>
            </div>
            <div className="divide-y divide-black/4">
              {byDistrict.map((d) => {
                const rate = Math.round((d.active / Math.max(d.total, 1)) * 100);
                const barColor = rate >= 85 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-400" : "bg-rose-500";
                return (
                  <div key={d.name} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 text-sm hover:bg-white/40">
                    <div>
                      <Link href={filterHref({ district: d.name })} className="font-semibold hover:text-indigo-600 hover:underline">
                        อ.{d.name}
                      </Link>
                      <div className="mt-1.5">
                        <PctBar value={d.total} max={maxDistrict} color="bg-indigo-300" />
                      </div>
                    </div>
                    <span className="text-center text-xs text-[var(--muted)]">{d.facilityCount} หน่วยงาน</span>
                    <span className="text-center font-semibold">{d.total}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs">{rate}%</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{d.active}</span>
                      {d.broken > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">{d.broken}</span>}
                      {d.inactive > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{d.inactive}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Device type horizontal bar chart */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="mb-5 font-semibold">ประเภทอุปกรณ์ — Top {Math.min(byType.length, 10)}</h2>
            <div className="space-y-3">
              {byType.slice(0, 10).map((t, i) => (
                <div key={t.type} className="flex items-center gap-3 text-sm">
                  <span className="w-4 shrink-0 text-right text-xs text-[var(--muted)]">{i + 1}</span>
                  <span className="w-36 shrink-0 truncate text-xs font-medium">{t.type}</span>
                  {/* stacked bar */}
                  <div className="flex h-5 flex-1 overflow-hidden rounded-md bg-slate-100">
                    <div className="bg-emerald-400" style={{ width: `${(t.active / Math.max(t.total, 1)) * (t.total / maxType) * 100}%` }} />
                    <div className="bg-rose-400" style={{ width: `${(t.broken / Math.max(t.total, 1)) * (t.total / maxType) * 100}%` }} />
                    <div className="bg-amber-300" style={{ width: `${(t.inactive / Math.max(t.total, 1)) * (t.total / maxType) * 100}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold">{t.total}</span>
                </div>
              ))}
            </div>
            {/* legend */}
            <div className="mt-4 flex gap-4 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />ใช้งานอยู่</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />ชำรุด</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" />ไม่ใช้งาน</span>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW: FACILITIES */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === "facilities" && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-2 border-b border-black/6 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">รายละเอียดรายหน่วยงาน{districtFilter ? ` — อ.${districtFilter}` : ""}</h2>
            <span className="text-xs text-[var(--muted)]">{byFacility.length} หน่วยงาน · {total} ทรัพย์สิน</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-slate-50/60 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">หน่วยงาน</th>
                  <th className="px-4 py-2.5 text-left font-medium">อำเภอ</th>
                  <th className="px-4 py-2.5 text-center font-medium">รวม</th>
                  <th className="px-4 py-2.5 text-center font-medium">พร้อมใช้งาน</th>
                  <th className="px-4 py-2.5 text-center font-medium">ชำรุด</th>
                  <th className="px-4 py-2.5 text-center font-medium">ไม่ใช้งาน</th>
                  <th className="px-4 py-2.5 text-left font-medium">อัตรา พร้อมใช้งาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {byFacility.map((f) => {
                  const rate = Math.round((f.active / Math.max(f.total, 1)) * 100);
                  const barColor = rate >= 85 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-400" : "bg-rose-500";
                  return (
                    <tr key={f.id} className="hover:bg-white/50">
                      <td className="px-4 py-3 font-medium">{f.name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        <Link href={filterHref({ view: "facilities", district: f.district })} className="hover:text-indigo-600 hover:underline">
                          อ.{f.district}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{f.total}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{f.active}</td>
                      <td className="px-4 py-3 text-center text-rose-600">{f.broken || "–"}</td>
                      <td className="px-4 py-3 text-center text-amber-600">{f.inactive || "–"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs font-medium">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


    </main>
  );
}
