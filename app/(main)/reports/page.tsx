import { isItAsset, assetTypeLabel } from "@/lib/asset-policy";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { getFacilityById, listAssets } from "@/lib/assets";
import { hasPermission } from "@/lib/role-permissions";
import { listDisposalRequests } from "@/lib/asset-disposals";
import { listRepairs, summarizeRepairs } from "@/lib/asset-repairs";
import { listTransfers } from "@/lib/asset-transfers";
import { CAPITALIZATION_THRESHOLD, fiscalYearOf, fiscalYearRange, summarizeValuation, VALUATION_STATUS_LABELS } from "@/lib/asset-valuation";
import { buildDepreciationRollup } from "@/lib/depreciation-rollup";
import { DISPOSAL_REQUEST_TYPE_LABELS, DISPOSAL_STATUS_LABELS, DISPOSAL_STATUS_TONES, disposalMethodLabel } from "@/lib/disposal-options";
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_TONES } from "@/lib/repair-options";
import {
  buildReplacementPlan,
  DEFAULT_REPLACEMENT_RULES,
  repairWindowStart,
  REPLACEMENT_PRIORITY_LABELS,
  REPLACEMENT_REASON_LABELS,
  type ReplacementReason,
} from "@/lib/replacement-plan";
import { getPendingDisposalAssetIds, getRepairStats } from "@/lib/replacement-plan-db";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const v = p[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const VIEWS = [
  { key: "summary", label: "ภาพรวม" },
  { key: "facility", label: "แยกตามหน่วยงาน" },
  { key: "type", label: "แยกตามประเภท" },
  { key: "expiring", label: "ใกล้หมดอายุ MA" },
  { key: "broken", label: "ชำรุด / ไม่ใช้งาน" },
  { key: "replacement", label: "แผนทดแทน" },
  { key: "valuation", label: "มูลค่าและค่าเสื่อมราคา" },
  { key: "depreciation", label: "สรุปค่าเสื่อมรายปีงบ" },
  { key: "repairs", label: "งานซ่อม" },
  { key: "transfers", label: "โอนย้าย" },
  { key: "disposal", label: "จำหน่าย / สูญหาย" },
] as const;

const baht = (value: number | null | undefined) => (value === null || value === undefined ? "-" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const MIGRATION_NOTE = "ยังไม่ได้เปิดใช้ข้อมูลส่วนนี้ (ต้องรัน database/add_asset_lifecycle.sql)";

type View = (typeof VIEWS)[number]["key"];

const TODAY = new Date();

export default async function ReportsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "reports.view"))) redirect("/dashboard");
  if (user.role !== "admin" && !user.facilityId) redirect("/profile");

  const canMutate = user.role !== "viewer";

  const params = await searchParams;
  const view = (readParam(params, "view") || "summary") as View;
  const todayIso = TODAY.toISOString().slice(0, 10);
  const currentFiscalYear = fiscalYearOf(todayIso);
  const fiscalYear = Number(readParam(params, "fy")) || currentFiscalYear;
  const fyRange = fiscalYearRange(fiscalYear);
  const fyOptions = Array.from({ length: 8 }, (_, i) => currentFiscalYear - i);

  const scopedFacilityId = user.role === "admin" ? undefined : Number(user.facilityId);
  const [assets, scopedFacility] = await Promise.all([
    listAssets({ facilityId: scopedFacilityId }),
    scopedFacilityId ? getFacilityById(scopedFacilityId) : Promise.resolve(null),
  ]);
  const reportScopeLabel = scopedFacility?.name ?? (scopedFacilityId ? "หน่วยงานของคุณ" : "ทุกหน่วยงาน");
  const exportHref = scopedFacilityId ? `/api/export/assets?facilityId=${scopedFacilityId}` : "/api/export/assets";
  const total = assets.length;
  const active = assets.filter((a) => a.currentStatus === "Active").length;
  const broken = assets.filter((a) => a.currentStatus === "Broken").length;
  const inactive = assets.filter((a) => a.currentStatus === "Inactive").length;
  const hw = assets.filter((a) => isItAsset(a) && a.assetGroup === "Hardware").length;
  const sw = assets.filter((a) => isItAsset(a) && a.assetGroup === "Software").length;
  const terminalCount = assets.filter((a) => a.currentStatus === "Disposed" || a.currentStatus === "Lost").length;
  const facilities = new Set(assets.map((a) => a.facilityId)).size;
  const scopeIds = scopedFacilityId ? [scopedFacilityId] : undefined;
  const depreciationRollup = view === "depreciation"
    ? buildDepreciationRollup(assets.map((a) => ({ ...a, subtypeName: a.extensions[a.assetClass]?.subtypeName })), fiscalYear)
    : null;
  const valuationReport = view === "valuation"
    ? summarizeValuation(assets.map((a) => ({ ...a, subtypeName: a.extensions[a.assetClass]?.subtypeName })), fiscalYear, todayIso)
    : null;
  const [repairList, repairSummary, transferList, disposalList] = await Promise.all([
    view === "repairs" ? listRepairs({ facilityIds: scopeIds, dateFrom: fyRange.start, dateTo: fyRange.end, limit: 1000 }) : Promise.resolve(null),
    view === "repairs" ? summarizeRepairs({ facilityIds: scopeIds, dateFrom: fyRange.start, dateTo: fyRange.end }) : Promise.resolve(null),
    view === "transfers" ? listTransfers({ facilityIds: scopeIds, dateFrom: fyRange.start, dateTo: fyRange.end, limit: 1000 }) : Promise.resolve(null),
    view === "disposal" ? listDisposalRequests({ facilityIds: scopeIds, dateFrom: fyRange.start, dateTo: fyRange.end, limit: 1000 }) : Promise.resolve(null),
  ]);
  const districts = new Set(assets.map((a) => a.districtName)).size;
  const replacementPlan = view === "replacement"
    ? await (async () => {
        const [repairStats, pending] = await Promise.all([
          getRepairStats(repairWindowStart(todayIso, DEFAULT_REPLACEMENT_RULES.repairWindowYears), scopeIds),
          getPendingDisposalAssetIds(scopeIds),
        ]);
        return buildReplacementPlan(assets.map((a) => ({ ...a, subtypeName: a.extensions[a.assetClass]?.subtypeName })), repairStats, pending, todayIso);
      })()
    : null;

  // ── by facility ──────────────────────────────────────────────────────
  const byFacility = Object.values(
    assets.reduce<Record<number, { name: string; district: string; total: number; active: number; broken: number; inactive: number }>>(
      (acc, a) => {
        if (!acc[a.facilityId]) {
          acc[a.facilityId] = { name: a.facilityName, district: a.districtName, total: 0, active: 0, broken: 0, inactive: 0 };
        }
        acc[a.facilityId].total++;
        if (a.currentStatus === "Active") acc[a.facilityId].active++;
        if (a.currentStatus === "Broken") acc[a.facilityId].broken++;
        if (a.currentStatus === "Inactive") acc[a.facilityId].inactive++;
        return acc;
      },
      {}
    )
  ).sort((a, b) => b.total - a.total);

  // ── by device type ──────────────────────────────────────────────────
  const byType = Object.entries(
    assets.reduce<Record<string, { total: number; active: number; broken: number }>>(
      (acc, a) => {
        const key = assetTypeLabel(a);
        if (!acc[key]) acc[key] = { total: 0, active: 0, broken: 0 };
        acc[key].total++;
        if (a.currentStatus === "Active") acc[key].active++;
        if (a.currentStatus === "Broken") acc[key].broken++;
        return acc;
      },
      {}
    )
  )
    .map(([type, counts]) => ({ type, ...counts }))
    .sort((a, b) => b.total - a.total);

  // ── expiring MA ─────────────────────────────────────────────────────
  const expiring = assets
    .map((a) => {
      const d = a.maintenanceEndDate ? new Date(`${a.maintenanceEndDate}T00:00:00+07:00`) : null;
      const days = d && !isNaN(d.getTime()) ? Math.ceil((d.getTime() - TODAY.getTime()) / 86400000) : null;
      return { ...a, daysLeft: days };
    })
    .filter((a) => a.daysLeft !== null && a.daysLeft >= 0 && a.daysLeft <= 90)
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));

  // ── broken / inactive ───────────────────────────────────────────────
  const brokenList = assets.filter((a) => a.currentStatus === "Broken" || a.currentStatus === "Inactive");

  function navClass(key: View) {
    return `rounded-xl px-4 py-2 text-sm font-medium transition ${
      view === key
        ? "bg-[var(--primary)] text-white shadow-sm"
        : "bg-white/70 text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"
    }`;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · รายงาน</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">รายงาน</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">แสดงข้อมูล: {reportScopeLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted)]">ข้อมูล ณ วันที่ {formatThaiDate(TODAY)}</span>
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] transition hover:bg-[var(--primary-soft-strong)]"
          >
            <AppIcon name="download" className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {[
          { label: "ทรัพย์สินรวม", value: total, color: "text-[var(--accent-strong)]" },
          { label: "ใช้งานอยู่", value: active, color: "text-emerald-600" },
          { label: "ชำรุด", value: broken, color: "text-rose-600" },
          { label: "ไม่ใช้งาน", value: inactive, color: "text-amber-600" },
          { label: "จำหน่าย/สูญหาย", value: terminalCount, color: "text-slate-500" },
          { label: "IT Hardware", value: hw, color: "text-sky-700" },
          { label: "IT Software", value: sw, color: "text-indigo-600" },
          { label: "ทรัพย์สินกลุ่มอื่น", value: total - hw - sw, color: "text-slate-700" },
          { label: "หน่วยงาน", value: facilities, color: "text-[var(--accent-strong)]" },
          { label: "อำเภอ", value: districts, color: "text-[var(--accent-strong)]" },
        ].map((k) => (
          <div key={k.label} className="glass-panel rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/reports?view=${v.key}${fiscalYear !== currentFiscalYear ? `&fy=${fiscalYear}` : ""}`} className={navClass(v.key)}>
            {v.label}
          </Link>
        ))}
      </div>

      {/* ── View: summary ─────────────────────────────────────────────── */}
      {view === "summary" && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="border-b border-black/6 px-5 py-3 font-semibold">สรุปภาพรวมทรัพย์สิน</div>
          <div className="p-5 space-y-4">
            {[
              { label: assetStatusLabel("Active"), count: active, bar: "bg-emerald-500", tone: "success" as const },
              { label: assetStatusLabel("Inactive"), count: inactive, bar: "bg-amber-400", tone: "warning" as const },
              { label: assetStatusLabel("Broken"), count: broken, bar: "bg-rose-500", tone: "danger" as const },
            ].map(({ label, count, bar, tone }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <StatusBadge tone={tone}>{count} ({Math.round(count / Math.max(total, 1) * 100)}%)</StatusBadge>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── View: by facility ─────────────────────────────────────────── */}
      {view === "facility" && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/6 px-5 py-3 font-semibold">
            รายงานแยกตามหน่วยงาน <span className="ml-2 text-sm font-normal text-[var(--muted)]">{byFacility.length} หน่วยงาน</span>
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
                  <th className="px-4 py-2.5 text-center font-medium">อัตราพร้อมใช้งาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {byFacility.map((f) => {
                  const rate = Math.round((f.active / Math.max(f.total, 1)) * 100);
                  return (
                    <tr key={f.name} className="transition hover:bg-white/50">
                      <td className="px-4 py-3 font-medium">{f.name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">อ.{f.district}</td>
                      <td className="px-4 py-3 text-center font-semibold">{f.total}</td>
                      <td className="px-4 py-3 text-center text-emerald-600">{f.active}</td>
                      <td className="px-4 py-3 text-center text-rose-600">{f.broken}</td>
                      <td className="px-4 py-3 text-center text-amber-600">{f.inactive}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${rate >= 85 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-400" : "bg-rose-500"}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-xs">{rate}%</span>
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

      {/* ── View: by device type ──────────────────────────────────────── */}
      {view === "type" && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/6 px-5 py-3 font-semibold">
            รายงานแยกตามประเภท <span className="ml-2 text-sm font-normal text-[var(--muted)]">{byType.length} ประเภท</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-slate-50/60 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">ประเภทอุปกรณ์</th>
                  <th className="px-4 py-2.5 text-center font-medium">รวม</th>
                  <th className="px-4 py-2.5 text-center font-medium">พร้อมใช้งาน</th>
                  <th className="px-4 py-2.5 text-center font-medium">ชำรุด</th>
                  <th className="px-4 py-2.5 text-left font-medium">สัดส่วน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {byType.map((t) => (
                  <tr key={t.type} className="transition hover:bg-white/50">
                    <td className="px-4 py-3">
                      <StatusBadge tone="primary">{t.type}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{t.total}</td>
                    <td className="px-4 py-3 text-center text-emerald-600">{t.active}</td>
                    <td className="px-4 py-3 text-center text-rose-600">{t.broken}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(t.total / Math.max(total, 1)) * 100}%` }} />
                        </div>
                        <span className="text-xs text-[var(--muted)]">{Math.round((t.total / Math.max(total, 1)) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── View: expiring MA ─────────────────────────────────────────── */}
      {view === "expiring" && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/6 px-5 py-3 font-semibold">
            ทรัพย์สินใกล้หมดอายุ MA (ภายใน 90 วัน)
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">{expiring.length} รายการ</span>
          </div>
          {expiring.length === 0 ? (
            <div className="p-10 text-center text-[var(--muted)]">ไม่มีทรัพย์สินใกล้หมดอายุ MA ในช่วง 90 วัน</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6 bg-slate-50/60 text-xs text-[var(--muted)]">
                    <th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th>
                    <th className="px-4 py-2.5 text-left font-medium">หน่วยงาน</th>
                    <th className="px-4 py-2.5 text-left font-medium">วันหมดอายุ</th>
                    <th className="px-4 py-2.5 text-center font-medium">เหลือ (วัน)</th>
                    <th className="px-4 py-2.5 text-center font-medium">ความเร่งด่วน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/4">
                  {expiring.map((a) => (
                    <tr key={a.id} className="transition hover:bg-white/50">
                      <td className="px-4 py-3">
                        <Link href={`/assets/${a.id}`} className="font-medium hover:text-[var(--accent-strong)] hover:underline">{a.assetName}</Link>
                        <p className="font-mono text-xs text-[var(--muted)]">{a.assetNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{a.facilityName}</td>
                      <td className="px-4 py-3 text-xs">{formatThaiDate(a.maintenanceEndDate)}</td>
                      <td className="px-4 py-3 text-center font-semibold">{a.daysLeft}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge tone={(a.daysLeft ?? 99) <= 7 ? "danger" : (a.daysLeft ?? 99) <= 30 ? "warning" : "neutral"}>
                          {(a.daysLeft ?? 99) <= 7 ? "วิกฤต" : (a.daysLeft ?? 99) <= 30 ? "เฝ้าระวัง" : "ปกติ"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── View: broken / inactive ───────────────────────────────────── */}
      {view === "broken" && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/6 px-5 py-3 font-semibold">
            ทรัพย์สินชำรุด / ไม่ใช้งาน
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">{brokenList.length} รายการ</span>
          </div>
          {brokenList.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-10 text-center text-[var(--primary-text)]">
              <AppIcon name="check" className="h-4 w-4" /> ไม่มีทรัพย์สินชำรุดหรือไม่ใช้งาน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6 bg-slate-50/60 text-xs text-[var(--muted)]">
                    <th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th>
                    <th className="px-4 py-2.5 text-left font-medium">หน่วยงาน</th>
                    <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
                    <th className="px-4 py-2.5 text-center font-medium">สถานะ</th>
                    <th className="px-4 py-2.5 text-left font-medium">อัปเดต</th>
                    <th className="px-4 py-2.5 text-right font-medium">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/4">
                  {brokenList.map((a) => (
                    <tr key={a.id} className="transition hover:bg-white/50">
                      <td className="px-4 py-3">
                        <Link href={`/assets/${a.id}`} className="font-medium hover:text-[var(--accent-strong)] hover:underline">{a.assetName}</Link>
                        <p className="font-mono text-xs text-[var(--muted)]">{a.assetNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{a.facilityName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="neutral">{assetTypeLabel(a)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge tone={assetStatusTone(a.currentStatus)}>
                          {assetStatusLabel(a.currentStatus)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatThaiDate(a.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {canMutate ? (
                          <Link href={`/disposal?assetId=${a.id}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                            ดำเนินการ
                          </Link>
                        ) : (
                          <span className="rounded-lg border border-stone-300 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                            ดูข้อมูลเท่านั้น
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ── View: replacement plan ─────────────────────────────────────── */}
      {view === "replacement" && replacementPlan && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-3 border-b border-black/6 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-semibold">
                แผนการจัดหาครุภัณฑ์ทดแทน ปีงบประมาณ {currentFiscalYear + 1}
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">{replacementPlan.items.length.toLocaleString("th-TH")} รายการ</span>
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                เกณฑ์: ชำรุด · ตัดค่าเสื่อมครบหรือใช้งานเกินอายุ · ซ่อม {DEFAULT_REPLACEMENT_RULES.repairCountMin} ครั้งขึ้นไปใน {DEFAULT_REPLACEMENT_RULES.repairWindowYears} ปี · ค่าซ่อมสะสม ≥ {Math.round(DEFAULT_REPLACEMENT_RULES.repairCostRatio * 100)}% ของราคาทุน · ไม่ใช้งาน
                — คะแนนรวมกำหนดความเร่งด่วน งบประมาณประมาณการจากราคาทุนเดิม
              </p>
            </div>
            <a href={`/api/export/replacement${scopedFacilityId ? `?facilityId=${scopedFacilityId}` : ""}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-4 text-sm font-semibold text-[var(--primary-text)] hover:bg-[var(--primary-soft-strong)]">
              <AppIcon name="download" className="h-4 w-4" /> แผนทดแทน Excel
            </a>
          </div>
          <div className="grid gap-3 border-b border-black/6 p-5 sm:grid-cols-3">
            {(["High", "Medium", "Low"] as const).map((priority) => (
              <div key={priority} className="rounded-xl border border-black/6 bg-white/70 p-4">
                <p className="text-xs text-[var(--muted)]">{REPLACEMENT_PRIORITY_LABELS[priority]}</p>
                <p className={`mt-1 text-2xl font-bold ${priority === "High" ? "text-rose-600" : priority === "Medium" ? "text-amber-600" : "text-slate-600"}`}>{replacementPlan.counts[priority].toLocaleString("th-TH")}</p>
                {priority !== "Low" && <p className="mt-0.5 text-xs text-[var(--muted)]">ประมาณ {baht(replacementPlan.estimatedBudget[priority])} บาท</p>}
              </div>
            ))}
            <p className="text-xs text-[var(--muted)] sm:col-span-3">
              {(Object.keys(REPLACEMENT_REASON_LABELS) as ReplacementReason[]).map((reason) => `${REPLACEMENT_REASON_LABELS[reason]} ${replacementPlan.reasonCounts[reason].toLocaleString("th-TH")}`).join(" · ")}
            </p>
          </div>
          {replacementPlan.items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-10 text-center text-[var(--primary-text)]">
              <AppIcon name="check" className="h-4 w-4" /> ยังไม่มีครุภัณฑ์ที่เข้าเกณฑ์จัดหาทดแทน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6 bg-slate-50/60 text-xs text-[var(--muted)]">
                    <th className="px-4 py-2.5 text-left font-medium">ความเร่งด่วน</th>
                    <th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th>
                    <th className="px-4 py-2.5 text-left font-medium">หน่วยงาน</th>
                    <th className="px-4 py-2.5 text-right font-medium">อายุ (ปี)</th>
                    <th className="px-4 py-2.5 text-right font-medium">ราคาทุน</th>
                    <th className="px-4 py-2.5 text-right font-medium">มูลค่าสุทธิ</th>
                    <th className="px-4 py-2.5 text-right font-medium">ซ่อม (ครั้ง / บาท)</th>
                    <th className="px-4 py-2.5 text-left font-medium">เหตุผล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/4">
                  {replacementPlan.items.slice(0, 500).map((item) => (
                    <tr key={item.asset.id} className="align-top transition hover:bg-white/50">
                      <td className="px-4 py-3">
                        <StatusBadge tone={item.priority === "High" ? "danger" : item.priority === "Medium" ? "warning" : "neutral"}>{REPLACEMENT_PRIORITY_LABELS[item.priority]}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${item.asset.id}`} className="font-medium hover:text-[var(--accent-strong)] hover:underline">{item.asset.assetName}</Link>
                        <p className="font-mono text-xs text-[var(--muted)]">{item.asset.assetNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{item.asset.facilityName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.ageYears ?? "-"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{baht(item.asset.purchasePrice)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{baht(item.valuation.bookValue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.repairs.totalCount ? `${item.repairs.totalCount} / ${baht(item.repairs.totalCost)}` : "-"}</td>
                      <td className="px-4 py-3 text-xs">
                        {item.reasons.map((reason) => REPLACEMENT_REASON_LABELS[reason]).join(", ")}
                        {item.pendingDisposal && <span className="mt-1 block text-[var(--muted)]">มีคำขอจำหน่ายรออนุมัติ</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {replacementPlan.items.length > 500 && <p className="px-5 py-3 text-xs text-[var(--muted)]">แสดง 500 รายการแรก — ดาวน์โหลด Excel เพื่อดูทั้งหมด</p>}
            </div>
          )}
        </div>
      )}
      {["valuation", "depreciation", "repairs", "transfers", "disposal"].includes(view) && (
        <form method="GET" className="flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="report-fy" className="text-[var(--muted)]">ปีงบประมาณ</label>
          <select id="report-fy" name="fy" defaultValue={fiscalYear} className="filter-control">
            {fyOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button className="rounded-lg border border-[var(--line)] bg-white px-3 py-1">แสดง</button>
          <span className="text-xs text-[var(--muted)]">{formatThaiDate(fyRange.start)} – {formatThaiDate(fyRange.end)}</span>
        </form>
      )}


      {/* ── View: depreciation rollup (สำหรับงานการเงิน) ─────────────── */}
      {view === "depreciation" && depreciationRollup && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h2 className="text-base font-semibold">งบแสดงการเปลี่ยนแปลงค่าเสื่อมราคา ปีงบประมาณ {fiscalYear}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {reportScopeLabel} · รอบบัญชี {formatThaiDate(depreciationRollup.periodStart)} – {formatThaiDate(depreciationRollup.periodEnd)} ·
              ปิดยอดทุก 30 กันยายน · ไม่นับครุภัณฑ์ที่จำหน่าย/สูญหายแล้ว {depreciationRollup.excludedTerminal.toLocaleString("th-TH")} รายการ
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "ราคาทุนรวม (บาท)", value: baht(depreciationRollup.totals.cost) },
              { label: "ค่าเสื่อมสะสมยกมา (บาท)", value: baht(depreciationRollup.totals.openingAccumulated) },
              { label: `ค่าเสื่อมราคาปีงบ ${fiscalYear} (บาท)`, value: baht(depreciationRollup.totals.depreciationThisYear) },
              { label: "มูลค่าสุทธิยกไป (บาท)", value: baht(depreciationRollup.totals.closingBookValue) },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-panel rounded-2xl p-4">
                <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>

          {!depreciationRollup.balanced && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              ยอดยกมา + ค่าเสื่อมปีนี้ ไม่เท่ากับยอดยกไป กรุณาตรวจสอบข้อมูลวันที่ได้มา/ราคาของครุภัณฑ์
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/export/depreciation?fy=${fiscalYear}${scopedFacilityId ? `&facilityId=${scopedFacilityId}` : ""}`}
              className="filter-button border border-[var(--line)] text-[var(--primary-text)]"
            >
              ดาวน์โหลด CSV
            </a>
            {depreciationRollup.totals.incomplete > 0 && (
              <span className="text-xs text-[var(--muted)]">
                ข้อมูลไม่ครบจึงยังคิดค่าเสื่อมไม่ได้ {depreciationRollup.totals.incomplete.toLocaleString("th-TH")} รายการ
              </span>
            )}
          </div>

          <div className="glass-panel overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-[var(--neutral-bg)] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">หน่วยงาน</th>
                  <th className="px-4 py-3 text-right font-semibold">จำนวน</th>
                  <th className="px-4 py-3 text-right font-semibold">ราคาทุน</th>
                  <th className="px-4 py-3 text-right font-semibold">ค่าเสื่อมสะสมยกมา</th>
                  <th className="px-4 py-3 text-right font-semibold">ค่าเสื่อมปีนี้</th>
                  <th className="px-4 py-3 text-right font-semibold">ค่าเสื่อมสะสมยกไป</th>
                  <th className="px-4 py-3 text-right font-semibold">มูลค่าสุทธิยกไป</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {depreciationRollup.rows.map((row) => (
                  <tr key={row.facilityId ?? row.facilityName}>
                    <td className="px-4 py-3">{row.facilityName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.count.toLocaleString("th-TH")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{baht(row.cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{baht(row.openingAccumulated)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{baht(row.depreciationThisYear)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{baht(row.closingAccumulated)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{baht(row.closingBookValue)}</td>
                  </tr>
                ))}
                {depreciationRollup.rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">ไม่มีข้อมูลในปีงบประมาณนี้</td></tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-[var(--line)] bg-[var(--neutral-bg)] font-semibold">
                <tr>
                  <td className="px-4 py-3">รวมทั้งสิ้น</td>
                  <td className="px-4 py-3 text-right tabular-nums">{depreciationRollup.totals.count.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{baht(depreciationRollup.totals.cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{baht(depreciationRollup.totals.openingAccumulated)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{baht(depreciationRollup.totals.depreciationThisYear)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{baht(depreciationRollup.totals.closingAccumulated)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{baht(depreciationRollup.totals.closingBookValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── View: valuation ───────────────────────────────────────────── */}
      {view === "valuation" && valuationReport && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "ราคาทุนรวม (บาท)", value: baht(valuationReport.totals.cost) },
              { label: `ค่าเสื่อมราคาปีงบ ${fiscalYear} (บาท)`, value: baht(valuationReport.totals.depreciationThisYear) },
              { label: "ค่าเสื่อมสะสม (บาท)", value: baht(valuationReport.totals.accumulated) },
              { label: "มูลค่าสุทธิ (บาท)", value: baht(valuationReport.totals.bookValue) },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-panel rounded-2xl p-4">
                <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/6 px-5 py-3">
              <div>
                <p className="font-semibold">สรุปมูลค่าตามประเภททรัพย์สิน</p>
                <p className="text-xs text-[var(--muted)]">ณ วันที่ {formatThaiDate(valuationReport.asOf)} · เส้นตรง ราคาซาก 1 บาท · ไม่รวมรายการจำหน่าย/สูญหาย {valuationReport.terminalCount} รายการ</p>
              </div>
              <a href={`/api/export/valuation?fy=${fiscalYear}${scopedFacilityId ? `&facilityId=${scopedFacilityId}` : ""}`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--primary-soft-strong)]">
                <AppIcon name="download" className="h-4 w-4" /> ทะเบียนค่าเสื่อม CSV
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50/60 text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">ประเภท (ตารางอายุการใช้งาน)</th>
                    <th className="px-4 py-2.5 text-right font-medium">จำนวน</th>
                    <th className="px-4 py-2.5 text-right font-medium">ราคาทุน</th>
                    <th className="px-4 py-2.5 text-right font-medium">ค่าเสื่อมปีงบ</th>
                    <th className="px-4 py-2.5 text-right font-medium">ค่าเสื่อมสะสม</th>
                    <th className="px-4 py-2.5 text-right font-medium">มูลค่าสุทธิ</th>
                    <th className="px-4 py-2.5 text-right font-medium">ครบอายุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/4">
                  {valuationReport.rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">ยังไม่มีรายการที่มีราคาและวันที่ได้มาครบสำหรับคิดค่าเสื่อม</td></tr>
                  ) : valuationReport.rows.map((row) => (
                    <tr key={row.categoryId ?? "none"}>
                      <td className="px-4 py-2.5">{row.categoryId ? `${row.categoryId}. ` : ""}{row.categoryLabel}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(row.cost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(row.depreciationThisYear)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(row.accumulated)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(row.bookValue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.fullyDepreciated}</td>
                    </tr>
                  ))}
                </tbody>
                {valuationReport.rows.length > 0 && (
                  <tfoot className="border-t border-black/10 font-semibold">
                    <tr>
                      <td className="px-4 py-2.5">รวม</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{valuationReport.totals.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(valuationReport.totals.cost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(valuationReport.totals.depreciationThisYear)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(valuationReport.totals.accumulated)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{baht(valuationReport.totals.bookValue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{valuationReport.totals.fullyDepreciated}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5 text-sm">
            <p className="font-semibold">รายการที่ไม่ได้คิดค่าเสื่อม</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {(Object.keys(valuationReport.excluded) as Array<keyof typeof valuationReport.excluded>).map((key) => (
                <li key={key} className="flex justify-between gap-3 border-b border-black/5 py-1">
                  <span className="text-[var(--muted)]">{VALUATION_STATUS_LABELS[key]}</span>
                  <span className="tabular-nums">{valuationReport.excluded[key]} รายการ</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--muted)]">ครุภัณฑ์ราคาต่ำกว่า {CAPITALIZATION_THRESHOLD.toLocaleString("th-TH")} บาท มูลค่ารวม {baht(valuationReport.belowThresholdCost)} บาท แสดงในทะเบียนแต่ไม่คิดค่าเสื่อม · ตัวเลขเป็นการประมาณการเพื่อบริหารทรัพย์สิน ไม่ใช่การบันทึกบัญชีแยกประเภท</p>
          </div>
          {(() => {
            const replace = valuationReport.items.filter((item) => item.valuation.isFullyDepreciated && item.asset.currentStatus === "Active").slice(0, 100);
            if (replace.length === 0) return null;
            return (
              <div className="glass-panel overflow-hidden rounded-2xl">
                <div className="border-b border-black/6 px-5 py-3 font-semibold">ครบอายุการใช้งานแล้วแต่ยังใช้งาน (พิจารณาทดแทน) <span className="ml-1 text-sm font-normal text-[var(--muted)]">{replace.length} รายการ</span></div>
                <ul className="divide-y divide-black/5 text-sm">
                  {replace.map(({ asset, valuation }) => (
                    <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2">
                      <Link href={`/assets/${asset.id}`} className="hover:underline">{asset.assetName} <span className="font-mono text-xs text-[var(--muted)]">{asset.assetNumber}</span></Link>
                      <span className="text-xs text-[var(--muted)]">{asset.facilityName} · ครบอายุ {formatThaiDate(valuation.fullyDepreciatedOn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── View: repairs ─────────────────────────────────────────────── */}
      {view === "repairs" && repairList && repairSummary && (
        !repairList.schemaReady ? <p className="glass-panel rounded-2xl p-5 text-sm text-amber-700">{MIGRATION_NOTE}</p> : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "แจ้งซ่อมในปีงบ", value: String(repairList.rows.length) },
                { label: "งานค้าง", value: String(repairSummary.open) },
                { label: "เวลาเฉลี่ยจนซ่อมเสร็จ", value: repairSummary.averageDaysToComplete === null ? "-" : `${repairSummary.averageDaysToComplete} วัน` },
                { label: "ค่าใช้จ่ายรวม (บาท)", value: baht(repairSummary.totalCost) },
              ].map((kpi) => (
                <div key={kpi.label} className="glass-panel rounded-2xl p-4"><p className="text-xs text-[var(--muted)]">{kpi.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{kpi.value}</p></div>
              ))}
            </div>
            <div className="glass-panel overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50/60 text-xs text-[var(--muted)]"><tr>
                  <th className="px-4 py-2.5 text-left font-medium">งาน</th><th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th><th className="px-4 py-2.5 text-left font-medium">หน่วยงาน</th>
                  <th className="px-4 py-2.5 text-center font-medium">สถานะ</th><th className="px-4 py-2.5 text-left font-medium">ผู้ซ่อม</th><th className="px-4 py-2.5 text-right font-medium">ค่าใช้จ่าย</th>
                </tr></thead>
                <tbody className="divide-y divide-black/4">
                  {repairList.rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">ไม่มีงานซ่อมในปีงบประมาณนี้</td></tr> : repairList.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5"><Link href={`/repairs/${row.id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">#{row.id}</Link><p className="text-xs text-[var(--muted)]">{formatThaiDate(row.reportedAt)}</p></td>
                      <td className="px-4 py-2.5"><Link href={`/assets/${row.assetId}`} className="hover:underline">{row.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo}</p></td>
                      <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.facilityName}</td>
                      <td className="px-4 py-2.5 text-center"><StatusBadge tone={REPAIR_STATUS_TONES[row.status]}>{REPAIR_STATUS_LABELS[row.status]}</StatusBadge></td>
                      <td className="px-4 py-2.5 text-xs">{row.vendorName || row.assignedTo || "-"}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums">{baht(row.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── View: transfers ───────────────────────────────────────────── */}
      {view === "transfers" && transferList && (
        !transferList.schemaReady ? <p className="glass-panel rounded-2xl p-5 text-sm text-amber-700">{MIGRATION_NOTE}</p> : (
          <div className="glass-panel overflow-x-auto rounded-2xl">
            <div className="border-b border-black/6 px-5 py-3 font-semibold">การโอนย้ายในปีงบ {fiscalYear} <span className="ml-1 text-sm font-normal text-[var(--muted)]">{transferList.rows.length} รายการ</span></div>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50/60 text-xs text-[var(--muted)]"><tr>
                <th className="px-4 py-2.5 text-left font-medium">วันที่</th><th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th><th className="px-4 py-2.5 text-left font-medium">จาก</th>
                <th className="px-4 py-2.5 text-left font-medium">ไป</th><th className="px-4 py-2.5 text-left font-medium">เอกสาร / เหตุผล</th><th className="px-4 py-2.5 text-left font-medium">ผู้บันทึก</th>
              </tr></thead>
              <tbody className="divide-y divide-black/4">
                {transferList.rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">ไม่มีการโอนย้ายในปีงบประมาณนี้</td></tr> : transferList.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs">{formatThaiDate(row.transferDate)}</td>
                    <td className="px-4 py-2.5"><Link href={`/assets/${row.assetId}`} className="hover:underline">{row.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo}</p></td>
                    <td className="px-4 py-2.5 text-xs">{row.fromFacilityName}<p className="text-[var(--muted)]">{[row.fromOwnerName, row.fromLocationDetail].filter(Boolean).join(" · ")}</p></td>
                    <td className="px-4 py-2.5 text-xs">{row.toFacilityName}<p className="text-[var(--muted)]">{[row.toOwnerName, row.toLocationDetail].filter(Boolean).join(" · ")}</p></td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.documentNo || "-"}{row.reason && <p>{row.reason}</p>}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.transferredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── View: disposal ────────────────────────────────────────────── */}
      {view === "disposal" && disposalList && (
        !disposalList.schemaReady ? <p className="glass-panel rounded-2xl p-5 text-sm text-amber-700">{MIGRATION_NOTE}</p> : (() => {
          const approved = disposalList.rows.filter((row) => row.status === "Approved");
          const sum = (rows: typeof approved, pick: (row: (typeof approved)[number]) => number | null) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "รออนุมัติ", value: String(disposalList.rows.filter((row) => row.status === "Pending").length) },
                  { label: "อนุมัติจำหน่าย / สูญหาย", value: `${approved.filter((row) => row.requestType === "Disposed").length} / ${approved.filter((row) => row.requestType === "Lost").length}` },
                  { label: "มูลค่าสุทธิที่ตัดจำหน่าย (บาท)", value: baht(sum(approved, (row) => row.bookValue)) },
                  { label: "เงินที่ได้รับจากการจำหน่าย (บาท)", value: baht(sum(approved, (row) => row.proceedsAmount)) },
                ].map((kpi) => (
                  <div key={kpi.label} className="glass-panel rounded-2xl p-4"><p className="text-xs text-[var(--muted)]">{kpi.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{kpi.value}</p></div>
                ))}
              </div>
              <div className="glass-panel overflow-x-auto rounded-2xl">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50/60 text-xs text-[var(--muted)]"><tr>
                    <th className="px-4 py-2.5 text-left font-medium">คำขอ</th><th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th><th className="px-4 py-2.5 text-left font-medium">ประเภท / วิธี</th>
                    <th className="px-4 py-2.5 text-right font-medium">ราคาทุน</th><th className="px-4 py-2.5 text-right font-medium">มูลค่าสุทธิ</th><th className="px-4 py-2.5 text-center font-medium">สถานะ</th><th className="px-4 py-2.5 text-left font-medium">หนังสืออนุมัติ</th>
                  </tr></thead>
                  <tbody className="divide-y divide-black/4">
                    {disposalList.rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">ไม่มีคำขอในปีงบประมาณนี้</td></tr> : disposalList.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2.5"><Link href={`/disposal?requestId=${row.id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">#{row.id}</Link><p className="text-xs text-[var(--muted)]">{formatThaiDate(row.requestedAt)}</p></td>
                        <td className="px-4 py-2.5"><Link href={`/assets/${row.assetId}`} className="hover:underline">{row.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo} · {row.facilityName}</p></td>
                        <td className="px-4 py-2.5 text-xs">{DISPOSAL_REQUEST_TYPE_LABELS[row.requestType]}{row.disposalMethod && <p className="text-[var(--muted)]">{disposalMethodLabel(row.disposalMethod)}</p>}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums">{baht(row.purchasePrice)}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums">{baht(row.bookValue)}</td>
                        <td className="px-4 py-2.5 text-center"><StatusBadge tone={DISPOSAL_STATUS_TONES[row.status]}>{DISPOSAL_STATUS_LABELS[row.status]}</StatusBadge></td>
                        <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.approvalDocumentNo || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
