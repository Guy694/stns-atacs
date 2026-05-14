import Link from "next/link";

import { getDashboardData } from "@/lib/atacs";
import { getCurrentUser } from "@/lib/auth";

type HomeProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Home({ searchParams }: HomeProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const params = await searchParams;
  const { facilitySurveys: allFacilitySurveys, districtCoverage, dataSource, connectionMessage, allowPublicOfficerBoard } =
    await getDashboardData();
  const isAdmin = currentUser.role === "admin";
  const isOfficer = currentUser.role === "officer";
  const isViewer = currentUser.role === "viewer";
  const canViewExactInfrastructure = isAdmin;
  const canViewPublicIpPanel = isAdmin || allowPublicOfficerBoard;
  const referenceDate = new Date("2026-05-08T00:00:00+07:00");

  // Officers can toggle: 'mine' (default) or 'all'
  const hasOwnFacility = isOfficer && !!currentUser.facilityId;
  const scopeParam = params.scope ?? "mine";
  const showingOwn = hasOwnFacility && scopeParam !== "all";

  const facilitySurveys = showingOwn
    ? allFacilitySurveys.filter((s) => s.facilityId === Number(currentUser.facilityId))
    : allFacilitySurveys;

  const scopeFacilityName = showingOwn
    ? (facilitySurveys[0]?.facilityName ?? "หน่วยงานของฉัน")
    : null;

  const allAssets = facilitySurveys.flatMap((survey) =>
    survey.assets.map((asset) => ({ ...asset, facilityName: survey.facilityName, districtName: survey.districtName }))
  );

  const totalAssets = allAssets.length;
  const safeTotalAssets = Math.max(totalAssets, 1);
  const activeAssets = allAssets.filter((a) => a.currentStatus === "Active").length;
  const brokenAssets = allAssets.filter((a) => a.currentStatus === "Broken").length;
  const inactiveAssets = allAssets.filter((a) => a.currentStatus === "Inactive").length;
  const hardwareCount = allAssets.filter((a) => a.assetGroup === "Hardware").length;
  const softwareCount = allAssets.filter((a) => a.assetGroup === "Software").length;
  const totalDistricts = new Set(facilitySurveys.map((s) => s.districtName)).size;
  const activeRate = Math.round((activeAssets / safeTotalAssets) * 100);

  const deviceTypes = Object.entries(
    allAssets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.deviceType] = (acc[asset.deviceType] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const districtSummary = Object.entries(
    facilitySurveys.reduce<Record<string, { assets: number; facilities: number; activeAssets: number }>>(
      (acc, survey) => {
        const cur = acc[survey.districtName] ?? { assets: 0, facilities: 0, activeAssets: 0 };
        acc[survey.districtName] = {
          assets: cur.assets + survey.assets.length,
          facilities: cur.facilities + 1,
          activeAssets: cur.activeAssets + survey.assets.filter((a) => a.currentStatus === "Active").length,
        };
        return acc;
      },
      {}
    )
  ).sort((a, b) => b[1].assets - a[1].assets);

  const expiringSoon = allAssets
    .map((asset) => ({
      ...asset,
      daysRemaining: Math.ceil(
        (new Date(asset.maintenanceEndDate).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
    .filter((a) => a.daysRemaining >= 0 && a.daysRemaining <= 45)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const maskPublicIp = (value?: string) => {
    if (!value) return "ซ่อนข้อมูล";
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.xxx.${parts[3]}` : "ซ่อนข้อมูล";
  };

  const maskPrivateIp = (value?: string) => {
    if (!value || value === "-") return "ซ่อนข้อมูล";
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "ซ่อนข้อมูล";
  };

  const coverageTone = (rate: number) =>
    rate >= 85 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-400" : "bg-rose-500";

  const urgencyStyle = (days: number) => {
    if (days <= 7)
      return { card: "border-rose-300 bg-rose-50/90", badge: "bg-rose-100 text-rose-700" };
    if (days <= 20)
      return { card: "border-amber-300 bg-amber-50/90", badge: "bg-amber-100 text-amber-700" };
    return { card: "border-yellow-200 bg-yellow-50/80", badge: "bg-yellow-100 text-yellow-700" };
  };

  const statusBadge = (status: string) => {
    if (status === "Active") return "bg-emerald-100 text-emerald-700";
    if (status === "Broken") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">

        {/* ── Page heading ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
              ATACS · Satun Digital Inventory
            </p>
            <h1 className="section-title mt-1 text-2xl font-semibold sm:text-3xl">
              {scopeFacilityName
                ? `Dashboard · ${scopeFacilityName}`
                : "Dashboard ทะเบียนทรัพย์สินสารสนเทศ สังกัด สป. จังหวัดสตูล"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope toggle for officers with a facility */}
            {hasOwnFacility && (
              <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white/70 p-0.5 text-sm font-medium shadow-sm">
                <Link
                  href="/?scope=mine"
                  className={`rounded-lg px-4 py-1.5 transition ${showingOwn ? "bg-[var(--accent-strong)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  หน่วยงานของฉัน
                </Link>
                <Link
                  href="/?scope=all"
                  className={`rounded-lg px-4 py-1.5 transition ${!showingOwn ? "bg-[var(--accent-strong)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  ทั้งหมด
                </Link>
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs text-[var(--muted)]">
              <span
                className={`h-2 w-2 rounded-full ${dataSource === "database" ? "bg-emerald-500" : "bg-amber-400"}`}
              />
              {connectionMessage}
            </div>
            <div className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 font-mono text-xs text-[var(--accent-strong)]">
              ข้อมูลวันที่ {new Date(Date.now()).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </div>

        {isViewer && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Viewer Mode: บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่ม แก้ไข หรือบันทึกการดำเนินการทรัพย์สิน
          </div>
        )}

        {/* ── KPI Strip ────────────────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white shadow-lg shadow-emerald-900/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">{scopeFacilityName ? "หน่วยงาน" : "หน่วยงาน"}</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{facilitySurveys.length}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {scopeFacilityName ? scopeFacilityName : `${totalDistricts} อำเภอ`}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white shadow-lg shadow-green-900/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">ทรัพย์สินรวม</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{totalAssets}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
              <span>{hardwareCount}  ฮาร์ดแวร์</span>
              <span className="text-white/30">·</span>
              <span>{softwareCount} ซอฟต์แวร์</span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 p-5 text-white shadow-lg shadow-teal-900/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">พร้อมใช้งาน</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{activeAssets}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/80" style={{ width: `${activeRate}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/60">{activeRate}% ของทั้งหมด</p>
          </div>

          <div className={`glass-panel rounded-2xl p-5 ${expiringSoon.length > 0 ? "border-amber-300/50" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">MA ใกล้หมดอายุ</p>
            <p
              className={`mt-3 text-4xl font-semibold tracking-tight ${expiringSoon.length > 0 ? "text-[var(--danger)]" : ""}`}
            >
              {expiringSoon.length}
            </p>
            <div className="mt-2 text-xs text-[var(--muted)]">
              {expiringSoon.length > 0
                ? `วิกฤต ${expiringSoon.filter((a) => a.daysRemaining <= 7).length} · เฝ้าระวัง ${expiringSoon.filter((a) => a.daysRemaining > 7).length}`
                : "ไม่มีแจ้งเตือนภายใน 45 วัน"}
            </div>
          </div>
        </div>

        {/* ── Operational + Distribution ───────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Operational Readiness */}
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Operational Readiness</p>
            <h2 className="section-title mt-1 text-xl font-semibold">สถานะการใช้งาน</h2>

            <div className="mt-5 space-y-4">
              {(
                [
                  { label: "Active", count: activeAssets, bar: "bg-emerald-500", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
                  { label: "Inactive", count: inactiveAssets, bar: "bg-amber-400", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700" },
                  { label: "Broken", count: brokenAssets, bar: "bg-rose-500", bg: "bg-rose-50", badge: "bg-rose-100 text-rose-700" },
                ] as const
              ).map(({ label, count, bar, badge }) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className={`h-2 w-2 rounded-full ${bar}`} />
                      {label}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>{count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / safeTotalAssets) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Public IP panel */}
            {canViewPublicIpPanel && (
              <div className="mt-6 rounded-xl border border-dashed border-black/10 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Public IP — {isAdmin ? "Admin (เต็ม)" : "Officer (Masked)"}
                </p>
                <div className="mt-3 grid gap-1.5 font-mono text-xs sm:grid-cols-2">
                  {allAssets.filter((a) => a.publicIp).length === 0 ? (
                    <p className="col-span-2 text-[var(--muted)]">ไม่มีข้อมูล Public IP</p>
                  ) : (
                    allAssets
                      .filter((a) => a.publicIp)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[var(--accent-strong)]"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          <span className="truncate">{a.assetName}:</span>
                          <span className="shrink-0">{isAdmin ? a.publicIp : maskPublicIp(a.publicIp)}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Asset Distribution */}
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Asset Distribution</p>
            <h2 className="section-title mt-1 text-xl font-semibold">ประเภทอุปกรณ์</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--accent-strong)] p-4 text-white">
                <p className="text-xs text-white/60">Hardware</p>
                <p className="mt-1.5 text-3xl font-semibold">{hardwareCount}</p>
                <p className="mt-0.5 text-xs text-white/60">{Math.round((hardwareCount / safeTotalAssets) * 100)}%</p>
              </div>
              <div className="rounded-xl border border-black/8 bg-white/80 p-4">
                <p className="text-xs text-[var(--muted)]">Software</p>
                <p className="mt-1.5 text-3xl font-semibold">{softwareCount}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{Math.round((softwareCount / safeTotalAssets) * 100)}%</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {deviceTypes.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{type}</span>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {count} / {totalAssets}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${(count / safeTotalAssets) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Provincial Coverage (admin/viewer only) ───────────────────────── */}
        {!scopeFacilityName && (
        <div className="glass-panel rounded-2xl p-6 lg:p-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Provincial Overview</p>
              <h2 className="section-title mt-1 text-xl font-semibold">ความครบถ้วนการสำรวจรายอำเภอ</h2>
            </div>
            <p className="text-xs text-[var(--muted)]">
              เขียว ≥ 85% · เหลือง ≥ 70% · แดง &lt; 70%
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.05fr]">
            {/* District progress bars */}
            <div className="space-y-3">
              {districtSummary.map(([district, summary]) => {
                const rate = Math.round((summary.activeAssets / Math.max(summary.assets, 1)) * 100);
                return (
                  <div key={district} className="rounded-xl border border-black/8 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${coverageTone(rate)}`} />
                        <span className="font-semibold">{district}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted)]">
                        <span>{summary.facilities} หน่วยงาน</span>
                        <span className="font-mono font-medium text-[var(--foreground)]">{summary.assets} รายการ</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${coverageTone(rate)}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      Active {rate}% · {summary.activeAssets} จาก {summary.assets} รายการ
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Stylised map */}
            <div className="relative min-h-[300px] overflow-hidden rounded-xl bg-[linear-gradient(160deg,#0e5751_0%,#0a4f47_45%,#0d6f63_100%)] p-5 text-white">
              <div className="absolute inset-x-5 top-4 flex items-center justify-between">
                <p className="text-xs font-medium tracking-[0.18em] text-white/50">MAP · SATUN</p>
                <div className="flex items-center gap-3 text-[10px] text-white/50">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />≥85%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />≥70%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />&lt;70%
                  </span>
                </div>
              </div>
              <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:30px_30px]" />
              <div className="absolute inset-[20%_16%_12%_14%] rounded-[38%_52%_45%_40%/28%_42%_56%_52%] border border-white/20 bg-white/5" />
              {districtCoverage.map((district) => (
                <div
                  key={district.district}
                  className="absolute w-max -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/25 px-2.5 py-1.5 shadow-lg backdrop-blur-md"
                  style={{ left: district.x, top: district.y }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${coverageTone(district.completionRate)}`} />
                    <p className="text-xs font-semibold">{district.district}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/55">{district.completionRate}% complete</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* ── MA Expiring Soon ──────────────────────────────────────────────── */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Maintenance Alert</p>
              <h2 className="section-title mt-1 text-xl font-semibold">สัญญาบำรุงรักษาใกล้หมดอายุ</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">นับรายการที่หมดอายุภายใน 45 วันนับจากรอบสำรวจ</p>
            </div>
            {expiringSoon.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 font-semibold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  วิกฤต ≤ 7 วัน — {expiringSoon.filter((a) => a.daysRemaining <= 7).length} รายการ
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  เฝ้าระวัง — {expiringSoon.filter((a) => a.daysRemaining > 7).length} รายการ
                </span>
              </div>
            )}
          </div>

          {expiringSoon.length === 0 ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-emerald-700">ไม่มีสัญญาบำรุงรักษาที่ใกล้หมดอายุ</p>
              <p className="mt-1 text-xs text-emerald-600">ทุกรายการมีสัญญาที่ยังมีผลบังคับใช้นานกว่า 45 วัน</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {expiringSoon.map((asset) => {
                const style = urgencyStyle(asset.daysRemaining);
                return (
                  <div key={asset.id} className={`rounded-xl border p-4 ${style.card}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{asset.assetName}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{asset.facilityName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${style.badge}`}>
                        {asset.daysRemaining} วัน
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-[var(--muted)]">
                      <span className="rounded-full bg-white/70 px-2.5 py-1">{asset.deviceType}</span>
                      <span className="rounded-full bg-white/70 px-2.5 py-1">สิ้นสุด {asset.maintenanceEndDate}</span>
                      {isAdmin && (
                        <span className="rounded-full bg-white/70 px-2.5 py-1">S/N: {asset.serialNumber}</span>
                      )}
                      {isAdmin && (
                        <span className="rounded-full bg-white/70 px-2.5 py-1">ผู้ดูแล: {asset.ownerName}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Facility Detail Cards ─────────────────────────────────────────── */}
        <div className="glass-panel rounded-2xl p-6 lg:p-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Facility Insight</p>
              <h2 className="section-title mt-1 text-xl font-semibold">
                {scopeFacilityName ? `ทรัพย์สิน · ${scopeFacilityName}` : "ทรัพย์สินรายหน่วยงาน"}
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)]">
              แสดงรายละเอียดตามสิทธิ์การเข้าถึง — {isAdmin ? "Admin (เต็ม)" : "Officer"}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {facilitySurveys.map((survey) => {
              const surveyActive = survey.assets.filter((a) => a.currentStatus === "Active").length;
              const surveyDegraded = survey.assets.length - surveyActive;
              return (
                <article
                  key={survey.facilityId}
                  className="flex flex-col overflow-hidden rounded-xl border border-black/8 bg-white/80"
                >
                  {/* Card header */}
                  <div className="border-b border-black/6 bg-white/90 px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-[var(--muted)]">{survey.districtName}</p>
                        <h3 className="mt-0.5 truncate text-base font-semibold">{survey.facilityName}</h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                          survey.completionRate >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : survey.completionRate >= 70
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {survey.completionRate}%
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-[var(--muted)]">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">สำรวจ {survey.surveyDate}</span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">บุคลากร {survey.personnelCount} คน</span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">by {survey.lastUpdatedBy}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active {surveyActive}
                      </span>
                      {surveyDegraded > 0 && (
                        <span className="flex items-center gap-1 text-rose-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          ปัญหา {surveyDegraded}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Asset rows */}
                  <div className="divide-y divide-black/5">
                    {survey.assets.map((asset) => (
                      <div key={asset.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{asset.assetName}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {canViewExactInfrastructure ? asset.locationDetail : "ภายในหน่วยงาน"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(asset.currentStatus)}`}
                          >
                            {asset.currentStatus}
                          </span>
                        </div>
                        {asset.usageDescription && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                            {asset.usageDescription}
                          </p>
                        )}
                        <div className="mt-2.5 space-y-1 text-xs text-[var(--muted)]">
                          {isAdmin && (
                            <div className="flex items-center justify-between gap-3">
                              <span>Owner</span>
                              <span className="font-medium text-[var(--foreground)]">{asset.ownerName}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-3">
                            <span>Network</span>
                            <span className="font-mono">
                              {canViewExactInfrastructure ? asset.privateIp : maskPrivateIp(asset.privateIp)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Updated</span>
                            <span className="text-[var(--foreground)]">
                              {asset.updatedBy} · {asset.updatedAt}
                            </span>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center justify-between gap-3">
                              <span>Serial</span>
                              <span className="font-mono text-[var(--foreground)]">{asset.serialNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
    </div>
  );
}

