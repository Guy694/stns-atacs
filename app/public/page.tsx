import Link from "next/link";

import { TopNavigation } from "@/app/_components/top-navigation";
import { getPublicDashboardData } from "@/lib/public-dashboard";

export default async function PublicDashboardPage() {
  const {
    totalAssets,
    totalFacilities,
    totalDistricts,
    activeAssets,
    degradedAssets,
    hardwareAssets,
    softwareAssets,
    districtSummary,
    deviceTypeSummary,
    dataSource,
    connectionMessage,
  } = await getPublicDashboardData();

  const safeTotalAssets = Math.max(totalAssets, 1);
  const activeRate = Math.round((activeAssets / safeTotalAssets) * 100);
  const topDevice = deviceTypeSummary[0];

  const coverageTone = (rate: number) =>
    rate >= 85
      ? { dot: "bg-emerald-500", bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" }
      : rate >= 70
        ? { dot: "bg-amber-400", bar: "bg-amber-400", badge: "bg-amber-100 text-amber-700" }
        : { dot: "bg-rose-500", bar: "bg-rose-500", badge: "bg-rose-100 text-rose-700" };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <TopNavigation current="public" user={null} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#4c1d95_0%,#5b21b6_40%,#4338ca_80%,#3b82f6_100%)] px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        {/* grid texture */}
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:40px_40px]" />
        {/* glow blob */}
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-emerald-300/10 blur-2xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-[0.2em] text-white/80 backdrop-blur-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${dataSource === "database" ? "bg-emerald-400" : "bg-amber-400"}`} />
              ATACS · PUBLIC DASHBOARD · สตูล
            </div>
            <h1 className="section-title mt-5 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              ทะเบียนทรัพย์สิน<br className="hidden sm:block" />สารสนเทศ จ.สตูล
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">
              ข้อมูลสรุประดับจังหวัดและอำเภอ สำหรับการติดตามสาธารณะ
              ไม่เปิดเผย IP, Serial, ผู้รับผิดชอบ และตำแหน่งติดตั้งรายเครื่อง
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/65 backdrop-blur-sm">
              <span>{connectionMessage}</span>
            </div>
          </div>

          {/* Active-rate ring visual */}
          <div className="flex shrink-0 flex-col items-center gap-3">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - activeRate / 100)}`}
                />
              </svg>
              <div className="z-10 text-center">
                <p className="text-3xl font-semibold">{activeRate}%</p>
                <p className="text-[11px] text-white/60">Active</p>
              </div>
            </div>
            <p className="text-xs text-white/55">{activeAssets} จาก {totalAssets} รายการ</p>
          </div>
        </div>

        {/* KPI row */}
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "หน่วยงาน", value: totalFacilities, sub: `${totalDistricts} อำเภอ` },
            { label: "ทรัพย์สินรวม", value: totalAssets, sub: `${hardwareAssets} HW · ${softwareAssets} SW` },
            { label: "พร้อมใช้งาน", value: activeAssets, sub: `${activeRate}% ของทั้งหมด`, accent: true },
            { label: "มีปัญหา / ไม่ใช้งาน", value: degradedAssets, sub: "Broken + Inactive", warn: degradedAssets > 0 },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`rounded-xl border px-4 py-4 backdrop-blur-sm ${
                kpi.accent
                  ? "border-white/30 bg-white/20"
                  : kpi.warn && degradedAssets > 0
                    ? "border-rose-300/30 bg-rose-500/15"
                    : "border-white/15 bg-white/10"
              }`}
            >
              <p className="text-xs text-white/55">{kpi.label}</p>
              <p className="mt-2 text-3xl font-semibold">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-white/45">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── District + Device ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* District cards */}
        <div className="glass-panel rounded-2xl p-6 lg:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Provincial Summary</p>
              <h2 className="section-title mt-1 text-xl font-semibold">ภาพรวมรายอำเภอ</h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />≥85%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />≥70%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />&lt;70%</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {districtSummary.map((district) => {
              const tone = coverageTone(district.completionRate);
              return (
                <div
                  key={district.districtName}
                  className="group rounded-xl border border-black/6 bg-white/75 p-4 transition hover:bg-white/95 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                      <span className="font-semibold">{district.districtName}</span>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${tone.badge}`}>
                      {district.completionRate}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${tone.bar}`}
                      style={{ width: `${district.completionRate}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
                    <span>{district.facilities} หน่วยงาน</span>
                    <span className="text-black/20">·</span>
                    <span className="font-mono">{district.assets} assets</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* HW / SW split */}
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Asset Mix</p>
            <h2 className="section-title mt-1 text-xl font-semibold">สัดส่วน Hardware / Software</h2>

            <div className="mt-5 flex h-3 overflow-hidden rounded-full">
              <div
                className="h-full bg-[var(--accent-strong)]"
                style={{ width: `${Math.round((hardwareAssets / safeTotalAssets) * 100)}%` }}
              />
              <div className="h-full flex-1 bg-emerald-200" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--accent-strong)] p-4 text-white">
                <p className="text-xs text-white/60">Hardware</p>
                <p className="mt-1.5 text-3xl font-semibold">{hardwareAssets}</p>
                <p className="mt-0.5 text-xs text-white/50">
                  {Math.round((hardwareAssets / safeTotalAssets) * 100)}%
                </p>
              </div>
              <div className="rounded-xl border border-black/8 bg-white/80 p-4">
                <p className="text-xs text-[var(--muted)]">Software</p>
                <p className="mt-1.5 text-3xl font-semibold">{softwareAssets}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {Math.round((softwareAssets / safeTotalAssets) * 100)}%
                </p>
              </div>
            </div>
          </div>

          {/* Device types */}
          <div className="glass-panel flex-1 rounded-2xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Device Types</p>
            <h2 className="section-title mt-1 text-xl font-semibold">ประเภทอุปกรณ์</h2>

            <div className="mt-5 space-y-3">
              {deviceTypeSummary.map((item, i) => (
                <div key={item.deviceType}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="rounded-full bg-[var(--accent-strong)] px-2 py-0.5 text-[10px] font-semibold text-white">
                          TOP
                        </span>
                      )}
                      <span className={i === 0 ? "font-semibold" : ""}>{item.deviceType}</span>
                    </div>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {item.count} รายการ
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${topDevice ? (item.count / topDevice.count) * 100 : 0}%`,
                        opacity: i === 0 ? 1 : 0.55 + i * 0.05,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Data transparency ──────────────────────────────────────────────── */}
      <section className="glass-panel rounded-2xl p-6 lg:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Data Transparency</p>
            <h2 className="section-title mt-1 text-xl font-semibold">ข้อมูลที่เปิดเผยและที่ถูกปกป้อง</h2>
          </div>
          <Link
            href="/login"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 sm:mt-0"
          >
            เข้าสู่ระบบเพื่อดูข้อมูลเพิ่มเติม
            <span>→</span>
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
              </span>
              <p className="font-semibold text-emerald-800">ข้อมูลสาธารณะ</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs leading-6 text-emerald-900/75">
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />จำนวนทรัพย์สินรวมระดับจังหวัดและอำเภอ</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />สัดส่วน Hardware / Software</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />ประเภทอุปกรณ์ระดับสรุป</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />ความครบถ้วนการสำรวจรายอำเภอ</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />สถานะพร้อมใช้งานแบบ aggregate</li>
            </ul>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-sm font-bold">
                ✕
              </span>
              <p className="font-semibold text-rose-800">ต้องผ่านการยืนยันตัวตน</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs leading-6 text-rose-900/75">
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />Public IP และ Private IP รายเครื่อง</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />Serial Number และเลขทะเบียนทรัพย์สิน</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />ชื่อผู้รับผิดชอบรายบุคคล</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />ตำแหน่งติดตั้งและ location detail</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />ประวัติการอัปเดตและ audit trail</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

