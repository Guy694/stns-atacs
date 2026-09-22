import { AssetFilters } from "@/app/(main)/assets/_components/asset-filters";
import { listAssetSubtypes } from "@/lib/asset-extensions";
import { isItAsset } from "@/lib/asset-policy";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetClassLabel } from "@/lib/asset-classes";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityById, listAssets, listAllFacilitiesForSelect } from "@/lib/assets";
import { formatThaiDate } from "@/lib/date-format";
import { listActiveDeviceTypes } from "@/lib/device-types";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { canAccessAssetFacility, canManageAssetRecord } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import ImportExcelModal from "@/app/(main)/assets/_components/import-excel-modal";
import { AssetFormModal } from "@/app/(main)/assets/_components/asset-form-modal";
import { DeleteAssetButton } from "@/app/(main)/assets/_components/delete-asset-button";
import { FacilityAssetQrActions } from "@/app/(main)/facilities/[id]/_components/facility-asset-qr-actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_LABELS: Record<string, string> = {
  Active: "พร้อมใช้งาน",
  Inactive: "ไม่ใช้งาน",
  Broken: "ชำรุด",
  Disposed: "จำหน่ายแล้ว",
  Lost: "สูญหาย",
};
const STATUS_TONE = {
  Active: "success",
  Inactive: "warning",
  Broken: "danger",
  Disposed: "neutral",
  Lost: "danger",
} as const;

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const value = p[key];
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function buildFacilityHref(facilityId: number, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `/facilities/${facilityId}?${queryString}` : `/facilities/${facilityId}`;
}



export default async function FacilityDetailPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const facilityId = Number(id);
  if (!facilityId) notFound();

  if (!canAccessAssetFacility(user, facilityId)) {
    redirect(user.facilityId ? "/facilities" : "/profile");
  }

  const query = await searchParams;
  const search = readParam(query, "search");
  const statusFilter = readParam(query, "status");
  const assetClassFilter = readParam(query, "assetClass");
  const subtypeFilter = Number(readParam(query, "subtype")) || undefined;
  const groupFilter = readParam(query, "group");
  const workGroupFilter = Number(readParam(query, "workGroup")) || undefined;
  const deviceTypeFilter = readParam(query, "deviceType");
  const maDaysFilter = readParam(query, "maDays");
  const maExpiringDays = Number(maDaysFilter) || undefined;
  const sort = readParam(query, "sort") as "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "ma_soon";
  const normalizedSort = ["updated_desc", "updated_asc", "name_asc", "name_desc", "ma_soon"].includes(sort) ? sort : undefined;

  const [allAssets, assets, facilitiesForSelect, workGroups, deviceTypes, subtypes] = await Promise.all([
    listAssets({ facilityId }),
    listAssets({
      facilityId,
      workGroupId: workGroupFilter,
      search: search || undefined,
      status: statusFilter || undefined,
      assetClass: assetClassFilter || undefined,
      subtypeId: subtypeFilter,
      assetGroup: groupFilter === "Hardware" || groupFilter === "Software" ? groupFilter : undefined,
      deviceType: deviceTypeFilter || undefined,
      maExpiringDays,
      sort: normalizedSort,
    }),
    listAllFacilitiesForSelect(user.role === "admin" ? undefined : { facilityId }),
    listFacilityWorkGroups(facilityId),
    listActiveDeviceTypes(),
    listAssetSubtypes(),
  ]);

  const currentFacility = await getFacilityById(facilityId);
  if (!currentFacility) notFound();

  const facilityName = allAssets[0]?.facilityName ?? currentFacility.name ?? `หน่วยงาน #${facilityId}`;
  const districtName = allAssets[0]?.districtName ?? currentFacility.district_name ?? "";

  const canManageAssets = canManageAssetRecord(user, facilityId);
  const [canCreateAsset, canUpdateAsset] = await Promise.all([
    hasPermission(user.role, "assets.create"),
    hasPermission(user.role, "assets.update"),
  ]);

  const totalAssets = allAssets.length;
  const activeCount = allAssets.filter((a) => a.currentStatus === "Active").length;
  const hardwareCount = allAssets.filter((a) => isItAsset(a) && a.assetGroup === "Hardware").length;
  const softwareCount = allAssets.filter((a) => isItAsset(a) && a.assetGroup === "Software").length;
  const referenceDate = new Date();


  const expiringSoon = allAssets
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
        {user.role === "officer" ? (
          <span>รายการทรัพย์สิน</span>
        ) : (
          <Link href="/assets" className="hover:text-[var(--accent)]">ทะเบียนทรัพย์สิน</Link>
        )}
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
            { label: "IT Hardware", value: hardwareCount },
            { label: "IT Software", value: softwareCount },
          ].map((kpi) => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${kpi.green ? "text-[var(--accent-strong)]" : ""}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

  

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
        <div className="flex flex-col gap-3 border-b border-black/6 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">รายการทรัพย์สินของหน่วยงานนี้</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              แสดง {assets.length.toLocaleString("th-TH")} จาก {totalAssets.toLocaleString("th-TH")} รายการ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageAssets && (canCreateAsset || canUpdateAsset) && (
              <ImportExcelModal
                facilities={[{ id: facilityId, name: facilityName, district_name: currentFacility.district_name }]}
                workGroups={workGroups}
                fixedFacilityId={facilityId}
              />
            )}
            <FacilityAssetQrActions
              facilityId={facilityId}
              facilityName={facilityName}
              assets={allAssets.map((asset) => ({
                id: asset.id,
                assetRegistrationNo: asset.assetRegistrationNo,
                assetName: asset.assetName,
              }))}
            />
            {canManageAssets && (
              <AssetFormModal
                facilities={facilitiesForSelect}
                deviceTypes={deviceTypes}
                workGroups={workGroups}
                fixedFacilityId={facilityId}
                updaterName={user.fullName}
                mode="create"
              >
                <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                  + เพิ่มทรัพย์สิน
                </button>
              </AssetFormModal>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <AssetFilters key={JSON.stringify(query)} resetHref={buildFacilityHref(facilityId, {})} values={{ search, status: statusFilter, assetClass: assetClassFilter, subtype: subtypeFilter, group: groupFilter, deviceType: deviceTypeFilter, workGroup: workGroupFilter, maDays: maDaysFilter, sort: normalizedSort }} subtypes={subtypes} deviceTypes={deviceTypes} workGroups={workGroups} />
        </div>

        {assets.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">ไม่พบรายการทรัพย์สินที่ตรงกับเงื่อนไข</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">เลขทะเบียน</th>
                  <th className="px-4 py-2.5 text-left font-medium">ชื่อทรัพย์สิน</th>
                  <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
                  <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
                  {canManageAssets && <th className="px-4 py-2.5 text-left font-medium">IP / Location</th>}
                  {canManageAssets && <th className="px-4 py-2.5 text-left font-medium">Serial</th>}
                  <th className="px-4 py-2.5 text-left font-medium">MA หมด</th>
                  {canManageAssets && <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {assets.map((asset) => (
                  <tr key={asset.id} className="transition hover:bg-white/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="font-mono text-xs font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
                      >
                        {asset.assetNumber || `#${asset.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{asset.assetName}</p>
                      {asset.usageDescription && (
                        <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-1">{asset.usageDescription}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone="primary">{assetClassLabel(asset.assetClass)}</StatusBadge>
                      {isItAsset(asset) && <><p className="mt-1 text-xs">{asset.deviceType || "–"}</p>
                      <p className="text-xs text-[var(--muted)]">{asset.assetGroup}</p></>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                      </StatusBadge>
                    </td>
                    {canManageAssets && (
                      <td className="px-4 py-3 font-mono text-xs">
                        <p>{isItAsset(asset) ? asset.privateIp || "–" : "–"}</p>
                        <p className="text-[var(--muted)]">{asset.locationDetail || ""}</p>
                      </td>
                    )}
                    {canManageAssets && (
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{asset.serialNumber || "–"}</td>
                    )}
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatThaiDate(asset.maintenanceEndDate)}</td>
                    {canManageAssets && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <AssetFormModal
                            facilities={facilitiesForSelect}
                            deviceTypes={deviceTypes}
                            workGroups={workGroups}
                            fixedFacilityId={facilityId}
                            updaterName={user.fullName}
                            mode="edit"
                            asset={asset}
                          >
                            <button className="inline-flex min-h-11 items-center rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-xs font-medium text-[var(--accent-strong)] hover:bg-white">
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
