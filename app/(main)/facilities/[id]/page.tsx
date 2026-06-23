import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityById, listAssets, listAllFacilitiesForSelect } from "@/lib/assets";
import { formatThaiDate } from "@/lib/date-format";
import { AssetFormModal } from "@/app/(main)/assets/_components/asset-form-modal";
import { DeleteAssetButton } from "@/app/(main)/assets/_components/delete-asset-button";
import { FacilityEditForm } from "./_components/facility-edit-form";

type Props = { params: Promise<{ id: string }> };

const STATUS_LABELS: Record<string, string> = {
  Active: "พร้อมใช้งาน",
  Inactive: "ไม่ใช้งาน",
  Broken: "ชำรุด",
};
const STATUS_TONE = {
  Active: "success",
  Inactive: "warning",
  Broken: "danger",
} as const;

export default async function FacilityDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const facilityId = Number(id);
  if (!facilityId) notFound();

  if (user.role === "officer" && user.facilityId && user.facilityId !== facilityId) {
    redirect(`/facilities/${user.facilityId}`);
  }

  if (user.role === "officer" && !user.facilityId) {
    redirect("/assets");
  }

  const [assets, facilitiesForSelect] = await Promise.all([
    listAssets({ facilityId }),
    listAllFacilitiesForSelect(),
  ]);

  const currentFacility = await getFacilityById(facilityId);
  if (!currentFacility) notFound();

  const facilityName = assets[0]?.facilityName ?? currentFacility.name ?? `หน่วยงาน #${facilityId}`;
  const districtName = assets[0]?.districtName ?? currentFacility.district_name ?? "";

  const canManage = user.role === "admin" || user.facilityId === facilityId;

  const totalAssets = assets.length;
  const activeCount = assets.filter((a) => a.currentStatus === "Active").length;
  const hardwareCount = assets.filter((a) => a.assetGroup === "Hardware").length;
  const softwareCount = assets.filter((a) => a.assetGroup === "Software").length;
  const referenceDate = new Date();

  const expiringSoon = assets
    .filter((a) => a.maintenanceEndDate)
    .map((a) => ({
      ...a,
      daysLeft: Math.ceil((new Date(a.maintenanceEndDate).getTime() - referenceDate.getTime()) / 86400000),
    }))
    .filter((a) => a.daysLeft <= 45)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/assets" className="hover:text-[var(--accent)]">ทะเบียนทรัพย์สิน</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{facilityName}</span>
      </div>

      {/* Hero */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="bg-[linear-gradient(135deg,#0a4f47,#0d6f63)] px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-medium tracking-[0.22em] text-white/60">FACILITY DETAIL · อ.{districtName}</p>
          <h1 className="section-title mt-2 text-3xl font-semibold sm:text-4xl">{facilityName}</h1>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black/6 sm:grid-cols-4">
          {[
            { label: "ทรัพย์สินรวม", value: totalAssets },
            { label: "พร้อมใช้งาน", value: activeCount, green: true },
            { label: "Hardware", value: hardwareCount },
            { label: "Software", value: softwareCount },
          ].map((kpi) => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${kpi.green ? "text-[var(--accent-strong)]" : ""}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {canManage && <FacilityEditForm facility={currentFacility} />}

      {/* MA Alert */}
      {expiringSoon.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AppIcon name="activity" className="h-4 w-4" /> MA ใกล้หมดอายุ ({expiringSoon.length} รายการ)
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {expiringSoon.map((a) => (
              <StatusBadge key={a.id} tone={a.daysLeft <= 7 ? "danger" : a.daysLeft <= 20 ? "warning" : "neutral"}>
                {a.assetName} ({a.daysLeft <= 0 ? "หมดแล้ว" : `${a.daysLeft} วัน`})
              </StatusBadge>
            ))}
          </div>
        </div>
      )}

      {/* Asset Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-3">
          <h2 className="font-semibold">รายการทรัพย์สินทั้งหมด</h2>
          {canManage && (
            <AssetFormModal facilities={facilitiesForSelect} fixedFacilityId={facilityId} updaterName={user.fullName} mode="create">
              <button className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-strong)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                + เพิ่มทรัพย์สิน
              </button>
            </AssetFormModal>
          )}
        </div>

        {assets.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">ยังไม่มีรายการทรัพย์สินสำหรับหน่วยงานนี้</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">เลขทะเบียน</th>
                  <th className="px-4 py-2.5 text-left font-medium">ชื่อทรัพย์สิน</th>
                  <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
                  <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
                  {canManage && <th className="px-4 py-2.5 text-left font-medium">IP / Location</th>}
                  {canManage && <th className="px-4 py-2.5 text-left font-medium">Serial</th>}
                  <th className="px-4 py-2.5 text-left font-medium">MA หมด</th>
                  {canManage && <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {assets.map((asset) => (
                  <tr key={asset.id} className="transition hover:bg-white/50">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{asset.assetRegistrationNo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{asset.assetName}</p>
                      {asset.usageDescription && (
                        <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-1">{asset.usageDescription}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs">{asset.deviceType || "–"}</p>
                      <p className="text-xs text-[var(--muted)]">{asset.assetGroup}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                      </StatusBadge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 font-mono text-xs">
                        <p>{asset.privateIp || "–"}</p>
                        <p className="text-[var(--muted)]">{asset.locationDetail || ""}</p>
                      </td>
                    )}
                    {canManage && (
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{asset.serialNumber || "–"}</td>
                    )}
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatThaiDate(asset.maintenanceEndDate)}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <AssetFormModal facilities={facilitiesForSelect} fixedFacilityId={facilityId} updaterName={user.fullName} mode="edit" asset={asset}>
                            <button className="rounded-lg border border-black/10 bg-white/80 px-3 py-1 text-xs font-medium text-[var(--accent-strong)] hover:bg-white">
                              แก้ไข
                            </button>
                          </AssetFormModal>
                          <DeleteAssetButton assetId={asset.id} assetName={asset.assetName} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
