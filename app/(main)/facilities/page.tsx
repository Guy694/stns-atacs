import Link from "next/link";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { listFacilities } from "@/lib/assets";
import { getAssetFacilityScopeIds } from "@/lib/facility-scope";

export default async function FacilitiesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const facilityScopeIds = getAssetFacilityScopeIds(user);
  if (facilityScopeIds === null) return null;
  const facilities = await listFacilities(
    facilityScopeIds === undefined ? undefined : { facilityIds: facilityScopeIds }
  );

  // Group by district
  const byDistrict = facilities.reduce<Record<string, typeof facilities>>((acc, f) => {
    const district = f.district_name ?? "ไม่ระบุอำเภอ";
    (acc[district] ??= []).push(f);
    return acc;
  }, {});

  const totalFacilities = facilities.length;
  const surveyed = facilities.filter((f) => f.has_survey > 0).length;
  const totalAssets = facilities.reduce((s, f) => s + f.asset_count, 0);

  const typeBadge = (typecode: string): "success" | "info" | "primary" | "warning" | "neutral" => {
    if (typecode.includes("รพ.ทั่วไป")) return "success";
    if (typecode.includes("รพ.ชุมชน")) return "info";
    if (typecode.includes("รพ.สต") || typecode.includes("สอน.") || typecode.includes("ศสช.")) return "primary";
    if (typecode.includes("สสจ") || typecode.includes("สสอ")) return "warning";
    return "neutral";
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · หน่วยบริการ</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">หน่วยบริการสาธารณสุข</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">จังหวัดสตูล · {totalFacilities} หน่วยงาน</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">หน่วยบริการทั้งหมด</p>
          <p className="mt-2 text-3xl font-bold text-[var(--accent)]">{totalFacilities}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">หน่วยงาน</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">มีข้อมูลทรัพย์สิน</p>
          <p className="mt-2 text-3xl font-bold text-[var(--accent)]">{surveyed}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            จาก {totalFacilities} หน่วยงาน ({Math.round((surveyed / (totalFacilities || 1)) * 100)}%)
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">ทรัพย์สินรวม</p>
          <p className="mt-2 text-3xl font-bold text-[var(--accent)]">{totalAssets.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">รายการ (ฮาร์ดแวร์ + ซอฟต์แวร์)</p>
        </div>
      </div>

      {/* Facility table by district */}
      {Object.entries(byDistrict).map(([district, facs]) => (
        <section key={district} className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/5 bg-[var(--accent-strong)]/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--accent-strong)]">
              อำเภอ{district} · {facs.length} หน่วยงาน
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.025] text-xs text-[var(--muted)]">
                  <th className="px-5 py-3 text-left font-medium">ชื่อหน่วยบริการ</th>
                  <th className="px-4 py-3 text-left font-medium">ประเภท</th>
                  <th className="px-4 py-3 text-center font-medium">ทรัพย์สิน</th>
                  <th className="px-4 py-3 text-center font-medium">IT Hardware</th>
                  <th className="px-4 py-3 text-center font-medium">IT Software</th>
                  <th className="px-4 py-3 text-center font-medium">สถานะข้อมูล</th>
                  <th className="px-4 py-3 text-right font-medium">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {facs.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-black/[0.02]">
                    <td className="px-5 py-3 font-medium text-[var(--foreground)]">{f.name}</td>
                    <td className="px-4 py-3">
	                      <StatusBadge tone={typeBadge(f.typecode)}>
	                        {f.typecode}
	                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{f.asset_count}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-emerald-600">{f.hw_count}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-lime-600">{f.sw_count}</td>
                    <td className="px-4 py-3 text-center">
                      {f.has_survey > 0 ? (
	                        <StatusBadge tone="success">
	                          มีข้อมูล
	                        </StatusBadge>
	                      ) : (
	                        <StatusBadge tone="neutral">
	                          ยังไม่มีข้อมูล
	                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/facilities/${f.id}`}
                        className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                      >
                        {f.has_survey > 0 ? "ดูรายละเอียด →" : "เริ่มกรอกข้อมูล →"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {facilities.length === 0 && (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl py-20 text-center">
          <p className="text-4xl">🏥</p>
          <p className="mt-3 font-medium text-[var(--foreground)]">ยังไม่พบข้อมูลหน่วยบริการ</p>
          <p className="mt-1 text-sm text-[var(--muted)]">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p>
        </div>
      )}
    </div>
  );
}
