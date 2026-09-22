import Link from "next/link";
import { redirect } from "next/navigation";

import { InspectionProgressPanel } from "@/app/_components/work-panels";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { listFacilities } from "@/lib/assets";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { fiscalYearOf } from "@/lib/asset-valuation";
import { getCurrentUser } from "@/lib/auth";
import { getInspectionProgress, listUncoveredAssets } from "@/lib/dashboard-work";
import { getAssetFacilityScopeIds } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const read = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key];
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
};

/** Which assets still on the register are not in any inspection round of the fiscal year. */
export default async function InspectionCoveragePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "inspection.view"))) redirect("/dashboard");
  const scopeIds = getAssetFacilityScopeIds(user);
  if (scopeIds === null) redirect("/profile");

  const params = await searchParams;
  const currentYear = fiscalYearOf(new Date().toISOString().slice(0, 10));
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);
  const fyParam = Number(read(params, "fy"));
  const fiscalYear = yearOptions.includes(fyParam) ? fyParam : currentYear;

  const facilities = await listFacilities(scopeIds ? { facilityIds: scopeIds } : undefined);
  const districts = [...new Set(facilities.map((f) => f.district_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "th"));
  const district = districts.includes(read(params, "district")) ? read(params, "district") : "";
  const facilityParam = Number(read(params, "facility"));
  const selected = facilities.filter((f) => (facilityParam ? f.id === facilityParam : !district || f.district_name === district));
  const facilityId = facilityParam && selected.length ? facilityParam : 0;
  const facilityIds = !scopeIds && !facilityId && !district ? null : selected.map((f) => f.id);

  const [progress, uncovered] = await Promise.all([
    getInspectionProgress(fiscalYear, selected.map((f) => ({ id: f.id, name: f.name, district: f.district_name ?? "" })), facilityIds),
    listUncoveredAssets(fiscalYear, facilityIds),
  ]);
  const hrefFor = (id?: number) => {
    const query = new URLSearchParams({ fy: String(fiscalYear) });
    if (id) query.set("facility", String(id));
    else if (district) query.set("district", district);
    return `/inspection/coverage?${query}`;
  };
  const canCreate = user.role !== "viewer" && (await hasPermission(user.role, "inspection.create"));
  const scopeLabel = facilityId ? selected[0]?.name : district ? `อำเภอ${district}` : "ทุกหน่วยงานในขอบเขตของคุณ";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/inspection" className="text-sm text-[var(--primary-text)] hover:underline">← ตรวจนับทรัพย์สิน</Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold"><AppIcon name="clipboard-check" className="h-6 w-6 text-[var(--primary)]" /> ความครอบคลุมการตรวจนับ ปีงบประมาณ {fiscalYear}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{scopeLabel} · ครุภัณฑ์ที่ยังอยู่ในทะเบียน (ไม่รวมที่จำหน่าย/สูญหายแล้ว)</p>
        </div>
        {canCreate && <Link href="/inspection?view=new" className="primary-action">+ เปิดรอบตรวจนับ</Link>}
      </header>

      <form method="GET" className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">ปีงบประมาณ</span>
          <select name="fy" defaultValue={String(fiscalYear)} className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm">
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">อำเภอ</span>
          <select name="district" defaultValue={district} className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm">
            <option value="">ทุกอำเภอ</option>
            {districts.map((name) => <option key={name} value={name ?? ""}>{name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">หน่วยงาน</span>
          <select name="facility" defaultValue={facilityId ? String(facilityId) : ""} className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm">
            <option value="">ทุกหน่วยงาน</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-11 self-end rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white">แสดง</button>
      </form>

      <section aria-labelledby="progress-heading" className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 id="progress-heading" className="mb-4 text-base font-semibold">ความคืบหน้ารายหน่วยงาน</h2>
        <InspectionProgressPanel progress={progress} coverageHref={hrefFor} limit={200} />
      </section>

      <section aria-labelledby="uncovered-heading" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 id="uncovered-heading" className="text-base font-semibold">ครุภัณฑ์ที่ยังไม่อยู่ในรอบตรวจนับใดของปีนี้ ({uncovered.total.toLocaleString("th-TH")} รายการ)</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">เปิดรอบตรวจนับตามกลุ่มงานเพื่อให้ครอบคลุมรายการเหล่านี้{uncovered.total > uncovered.rows.length ? ` · แสดง ${uncovered.rows.length.toLocaleString("th-TH")} รายการแรก` : ""}</p>
        </div>
        {uncovered.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">ครุภัณฑ์ทุกรายการอยู่ในรอบตรวจนับของปีงบประมาณ {fiscalYear} แล้ว</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[var(--neutral-bg)] text-left text-xs text-[var(--muted)]">
                <tr>{["เลขครุภัณฑ์", "รายการ", "หน่วยงาน", "กลุ่มงาน / ที่ตั้ง", "สถานะ"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {uncovered.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.assetNumber}</td>
                    <td className="px-4 py-2.5"><Link href={`/assets/${row.id}`} className="font-medium text-[var(--primary-text)] hover:underline">{row.assetName}</Link></td>
                    <td className="px-4 py-2.5">{row.facilityName}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)]">{[row.workGroupName || "ไม่ระบุกลุ่มงาน", row.locationDetail].filter(Boolean).join(" · ")}</td>
                    <td className="px-4 py-2.5"><StatusBadge tone={assetStatusTone(row.currentStatus)}>{assetStatusLabel(row.currentStatus)}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
