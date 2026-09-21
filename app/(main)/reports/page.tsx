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
] as const;

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
  const facilities = new Set(assets.map((a) => a.facilityId)).size;
  const districts = new Set(assets.map((a) => a.districtName)).size;

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
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: "ทรัพย์สินรวม", value: total, color: "text-[var(--accent-strong)]" },
          { label: "ใช้งานอยู่", value: active, color: "text-emerald-600" },
          { label: "ชำรุด", value: broken, color: "text-rose-600" },
          { label: "ไม่ใช้งาน", value: inactive, color: "text-amber-600" },
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
          <Link key={v.key} href={`/reports?view=${v.key}`} className={navClass(v.key)}>
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
                        <p className="font-mono text-xs text-[var(--muted)]">{a.assetRegistrationNo}</p>
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
                        <p className="font-mono text-xs text-[var(--muted)]">{a.assetRegistrationNo}</p>
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
    </div>
  );
}
