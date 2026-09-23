import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { listRepairs, summarizeRepairs } from "@/lib/asset-repairs";
import { fiscalYearOf, fiscalYearRange } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { getAssetFacilityScopeIds } from "@/lib/facility-scope";
import { canMutateAssets } from "@/lib/permissions";
import {
  REPAIR_PRIORITY_LABELS,
  REPAIR_PRIORITY_TONES,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_TONES,
  REPAIR_STATUSES,
  type RepairStatus,
} from "@/lib/repair-options";
import { hasPermission } from "@/lib/role-permissions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const readParam = (p: Record<string, string | string[] | undefined>, key: string) => (Array.isArray(p[key]) ? p[key]?.[0] : p[key]) ?? "";
const baht = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function RepairsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "repairs.view"))) redirect("/dashboard");
  const scopeIds = getAssetFacilityScopeIds(user);
  if (scopeIds === null) redirect("/profile");
  const canManage = canMutateAssets(user) && (await hasPermission(user.role, "repairs.manage"));

  const params = await searchParams;
  const statusParam = readParam(params, "status") || "open";
  const status = statusParam === "all" ? undefined : statusParam === "open" ? "open" : (REPAIR_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as RepairStatus) : "open";
  const currentFiscalYear = fiscalYearOf(new Date().toISOString().slice(0, 10));
  const fiscalYear = Number(readParam(params, "fy")) || currentFiscalYear;
  const range = fiscalYearRange(fiscalYear);

  const [list, summary] = await Promise.all([
    listRepairs({ facilityIds: scopeIds, status, limit: 500 }),
    summarizeRepairs({ facilityIds: scopeIds, dateFrom: range.start, dateTo: range.end }),
  ]);

  const tabs = [
    { key: "open", label: "งานค้าง" },
    ...REPAIR_STATUSES.map((key) => ({ key, label: REPAIR_STATUS_LABELS[key] })),
    { key: "all", label: "ทั้งหมด" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · ซ่อมบำรุง</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">งานซ่อมบำรุง</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">แจ้งซ่อม ติดตามสถานะ ค่าใช้จ่าย และทรัพย์สินที่เสียบ่อย</p>
        </div>
        {canManage && (
          <Link href="/repairs/new" className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]">
            + แจ้งซ่อม
          </Link>
        )}
      </div>

      {!list.schemaReady ? (
        <p className="glass-panel rounded-2xl p-6 text-sm text-amber-700">ยังไม่ได้เปิดใช้งานซ่อมบำรุง กรุณาให้ผู้ดูแลระบบรัน database/add_asset_lifecycle.sql</p>
      ) : (
        <>
          <section aria-label={`สรุปปีงบประมาณ ${fiscalYear}`} className="space-y-2">
            <form method="GET" className="flex flex-wrap items-center gap-2 text-xs">
              <input type="hidden" name="status" value={statusParam} />
              <label htmlFor="fy" className="text-[var(--muted)]">สรุปปีงบประมาณ</label>
              <select id="fy" name="fy" defaultValue={fiscalYear} className="filter-control">
                {Array.from({ length: 6 }, (_, i) => currentFiscalYear - i).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <button className="rounded-lg border border-[var(--line)] bg-white px-3 py-1">แสดง</button>
            </form>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "งานค้าง (ทั้งหมด)", value: String(list.rows.filter((row) => row.status !== "Completed" && row.status !== "Cancelled").length) },
                { label: `แจ้งซ่อมในปี ${fiscalYear}`, value: String(Object.values(summary.byStatus).reduce((a, b) => a + b, 0)) },
                { label: "ซ่อมเสร็จ", value: String(summary.completedCount) },
                { label: "เวลาเฉลี่ยจนซ่อมเสร็จ", value: summary.averageDaysToComplete === null ? "-" : `${summary.averageDaysToComplete} วัน` },
                { label: "ค่าใช้จ่ายรวม (บาท)", value: baht(summary.totalCost) },
              ].map((kpi) => (
                <div key={kpi.label} className="glass-panel rounded-2xl p-4">
                  <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
                </div>
              ))}
            </div>
          </section>

          {summary.frequentAssets.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="font-semibold">ทรัพย์สินที่ซ่อมบ่อย (ปี {fiscalYear})</h2>
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {summary.frequentAssets.map((item) => (
                  <li key={item.assetId} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/assets/${item.assetId}`} className="hover:underline">{item.assetName} <span className="font-mono text-xs text-[var(--muted)]">{item.assetRegistrationNo}</span></Link>
                    <span className="whitespace-nowrap text-xs text-[var(--muted)]">{item.count} ครั้ง · {baht(item.cost)} บาท</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav aria-label="กรองสถานะงานซ่อม" className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={`/repairs?status=${tab.key}&fy=${fiscalYear}`}
                aria-current={statusParam === tab.key ? "page" : undefined}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${statusParam === tab.key ? "bg-[var(--primary)] text-white" : "bg-white/70 text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <section className="glass-panel overflow-hidden rounded-2xl">
            {list.rows.length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--muted)]">ไม่มีงานซ่อมในสถานะนี้</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50/60 text-xs text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">งาน</th>
                      <th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th>
                      <th className="px-4 py-2.5 text-left font-medium">ปัญหา</th>
                      <th className="px-4 py-2.5 text-center font-medium">ความเร่งด่วน</th>
                      <th className="px-4 py-2.5 text-center font-medium">สถานะ</th>
                      <th className="px-4 py-2.5 text-left font-medium">ผู้รับผิดชอบ</th>
                      <th className="px-4 py-2.5 text-right font-medium">ค่าใช้จ่าย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4">
                    {list.rows.map((row) => (
                      <tr key={row.id} className="align-top hover:bg-white/50">
                        <td className="px-4 py-3"><Link href={`/repairs/${row.id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">#{row.id}</Link><p className="text-xs text-[var(--muted)]">{formatThaiDate(row.reportedAt)}</p></td>
                        <td className="px-4 py-3"><Link href={`/assets/${row.assetId}`} className="font-medium hover:underline">{row.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo} · {row.facilityName}</p></td>
                        <td className="max-w-xs px-4 py-3 text-xs text-[var(--muted)]"><p className="line-clamp-2">{row.problem}</p></td>
                        <td className="px-4 py-3 text-center"><StatusBadge tone={REPAIR_PRIORITY_TONES[row.priority]}>{REPAIR_PRIORITY_LABELS[row.priority]}</StatusBadge></td>
                        <td className="px-4 py-3 text-center"><StatusBadge tone={REPAIR_STATUS_TONES[row.status]}>{REPAIR_STATUS_LABELS[row.status]}</StatusBadge></td>
                        <td className="px-4 py-3 text-xs">{row.assignedTo || row.vendorName || "-"}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">{row.cost === null ? "-" : baht(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
