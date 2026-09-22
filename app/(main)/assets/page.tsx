import { AssetFilters } from "./_components/asset-filters";
import { listAssetSubtypes } from "@/lib/asset-extensions";
import { isItAsset } from "@/lib/asset-policy";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetClassLabel } from "@/lib/asset-classes";
import { getCurrentUser } from "@/lib/auth";
import { countAssets, listAssets, listAllFacilitiesForSelect, listFacilities, type AssetListFilter } from "@/lib/assets";
import { formatThaiDate } from "@/lib/date-format";
import { listActiveDeviceTypes } from "@/lib/device-types";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { canManageAsset, canSeeSensitiveAssetNetwork } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { AssetFormModal } from "./_components/asset-form-modal";
import { DeleteAssetButton } from "./_components/delete-asset-button";
import ImportExcelModal from "./_components/import-excel-modal";

type AssetsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const v = p[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function readPositiveIntParam(p: Record<string, string | string[] | undefined>, key: string, fallback: number) {
  const parsed = Number(readParam(p, key));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: number) {
  return [10, 25, 50, 100].includes(value) ? value : 25;
}

function buildAssetsHref(params: Record<string, string | number | undefined>, page: number) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  if (page > 1) {
    query.set("page", String(page));
  } else {
    query.delete("page");
  }

  const queryString = query.toString();
  return queryString ? `/assets?${queryString}` : "/assets";
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  return [...pages].sort((a, b) => a - b);
}

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
export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role !== "admin") {
    if ((user.managedAssetFacilityIds?.length ?? 0) > 1) redirect("/facilities");
    if (user.facilityId) redirect(`/facilities/${user.facilityId}`);
    redirect("/profile");
  }

  const canViewAssets = await hasPermission(user.role, "assets.view");
  if (!canViewAssets) return null;

  const isAdmin = user.role === "admin";

  const params = await searchParams;
  const search = readParam(params, "search");
  const statusFilter = readParam(params, "status");
  const districtFilter = readParam(params, "district");
  const assetClassFilter = readParam(params, "assetClass");
  const subtypeFilter = Number(readParam(params, "subtype")) || undefined;
  const groupFilter = readParam(params, "group");
  const workGroupFilter = Number(readParam(params, "workGroup")) || undefined;
  const deviceTypeFilter = readParam(params, "deviceType");
  const maExpiringDays = Number(readParam(params, "maDays")) || undefined;
  const sort = readParam(params, "sort") as "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "ma_soon";
  const requestedFacilityFilter = Number(readParam(params, "facility")) || undefined;
  const facilityFilter = requestedFacilityFilter;
  const requestedPage = readPositiveIntParam(params, "page", 1);
  const perPage = normalizePerPage(readPositiveIntParam(params, "perPage", 25));
  const assetFilter: AssetListFilter = {
    search: search || undefined,
    status: statusFilter || undefined,
    facilityId: facilityFilter,
    workGroupId: workGroupFilter,
    district: districtFilter || undefined,
    assetClass: assetClassFilter || undefined,
    subtypeId: subtypeFilter,
    assetGroup: groupFilter === "Hardware" || groupFilter === "Software" ? groupFilter : undefined,
    deviceType: deviceTypeFilter || undefined,
    maExpiringDays,
    sort: ["updated_desc", "updated_asc", "name_asc", "name_desc", "ma_soon"].includes(sort) ? sort : undefined,
  };

  const [totalAssets, facilitiesForSelect, facilities, deviceTypes, workGroups, subtypes] = await Promise.all([
    countAssets(assetFilter),
    listAllFacilitiesForSelect(),
    listFacilities(),
    listActiveDeviceTypes(),
    listFacilityWorkGroups(),
    listAssetSubtypes(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalAssets / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * perPage;
  const assets = await listAssets({ ...assetFilter, limit: perPage, offset });
  const pageStart = totalAssets === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + assets.length, totalAssets);
  const pageQuery = {
    subtype: subtypeFilter,
    search: search || undefined,
    status: statusFilter || undefined,
    assetClass: assetClassFilter || undefined,
    group: groupFilter || undefined,
    workGroup: workGroupFilter,
    deviceType: deviceTypeFilter || undefined,
    district: districtFilter || undefined,
    maDays: maExpiringDays,
    facility: requestedFacilityFilter,
    sort: sort || undefined,
    perPage: perPage === 25 ? undefined : perPage,
  };
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  const districtOptions = [
    ...new Set(facilitiesForSelect.map((facility) => facility.district_name).filter((district): district is string => Boolean(district))),
  ].sort();


  const facilitiesForForm = facilitiesForSelect;
  const canManageSubtypes = await hasPermission(user.role, "device-types.manage");
  const canCreateAssetByPolicy = await hasPermission(user.role, "assets.create");
  const canCreateAsset = canCreateAssetByPolicy && isAdmin;
  const canViewNetworkByPolicy = await hasPermission(user.role, "assets.network.view");
  const canUpdateAssetByPolicy = await hasPermission(user.role, "assets.update");

  // Group by district
  const byDistrict = assets.reduce<Record<string, typeof assets>>((acc, a) => {
    (acc[a.districtName] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · ทะเบียนทรัพย์สิน</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">รายการครุภัณฑ์และทรัพย์สิน</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {totalAssets.toLocaleString("th-TH")} รายการ
            {totalAssets > 0 && (
              <span> · แสดง {pageStart.toLocaleString("th-TH")}-{pageEnd.toLocaleString("th-TH")}</span>
            )}
          </p>
        </div>
        {canManageSubtypes && <Link href="/assets/subtypes" className="text-sm underline">จัดการประเภทย่อย</Link>}
        {canCreateAsset && (
          <div className="flex gap-2">
            {isAdmin && <ImportExcelModal facilities={facilities} workGroups={workGroups} />}
            <AssetFormModal
              facilities={facilitiesForForm}
              deviceTypes={deviceTypes}
              workGroups={workGroups}
              updaterName={user.fullName}
              mode="create"
            >
              <button className="primary-action">
                + เพิ่มทรัพย์สิน
              </button>
            </AssetFormModal>
          </div>
        )}
      </div>

      <AssetFilters key={JSON.stringify(pageQuery)} values={pageQuery} resetHref="/assets" subtypes={subtypes} deviceTypes={deviceTypes} facilities={facilitiesForSelect} districts={districtOptions} workGroups={workGroups} paginate />

      {/* Table by district */}
      {Object.entries(byDistrict).map(([district, items]) => (
        <div key={district} className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-black/6 px-5 py-3">
            <div>
              <span className="font-semibold">อ.{district}</span>
              <span className="ml-2 text-sm text-[var(--muted)]">{items.length} รายการ</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">เลขทะเบียน</th>
                  <th className="px-4 py-2.5 text-left font-medium">ชื่อทรัพย์สิน</th>
                  <th className="px-4 py-2.5 text-left font-medium">หน่วยงาน</th>
                  <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
                  <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
                  {canViewNetworkByPolicy && <th className="px-4 py-2.5 text-left font-medium">IP</th>}
                  <th className="px-4 py-2.5 text-left font-medium">MA หมด</th>
                  {canUpdateAssetByPolicy && <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {items.map((asset) => (
                  <tr key={asset.id} className="hover:bg-white/50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/assets/${asset.id}`} className="font-mono text-xs text-[var(--accent)] hover:underline">
                        {asset.assetNumber || `#${asset.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{asset.assetName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      <Link href={`/facilities/${asset.facilityId}`} className="hover:text-[var(--accent)] hover:underline">
                        {asset.facilityName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-44 flex-col gap-1">
                        <StatusBadge tone="primary">{assetClassLabel(asset.assetClass)}</StatusBadge>
                        <span className="text-xs text-[var(--muted)]">{isItAsset(asset) ? asset.deviceType || asset.assetGroup : "ทะเบียนทรัพย์สิน"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                      </StatusBadge>
                    </td>
                    {canViewNetworkByPolicy && canSeeSensitiveAssetNetwork(user, asset.facilityId) && (
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                        {isItAsset(asset) ? asset.privateIp || "–" : "–"}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {formatThaiDate(asset.maintenanceEndDate)}
                    </td>
                    {canUpdateAssetByPolicy && canManageAsset(user, asset.facilityId) && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <AssetFormModal
                            facilities={facilitiesForForm}
                            deviceTypes={deviceTypes}
                            workGroups={workGroups}
                            updaterName={user.fullName}
                            mode="edit"
                            asset={asset}
                          >
                            <button className="inline-flex min-h-11 items-center rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-xs font-medium text-[var(--accent-strong)] transition hover:bg-white">
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
        </div>
      ))}

      {assets.length === 0 && (
        <div className="glass-panel rounded-2xl p-12 text-center text-[var(--muted)]">
          ไม่พบรายการทรัพย์สินที่ตรงกับเงื่อนไข
        </div>
      )}

      {totalAssets > 0 && (
        <nav className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Asset pagination">
          <p className="text-sm text-[var(--muted)]">
            หน้า {currentPage.toLocaleString("th-TH")} จาก {totalPages.toLocaleString("th-TH")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {currentPage > 1 ? (
              <Link href={buildAssetsHref(pageQuery, currentPage - 1)} className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-medium hover:bg-white">
                ก่อนหน้า
              </Link>
            ) : (
              <span className="rounded-xl border border-black/6 bg-white/50 px-3 py-2 text-sm text-[var(--muted)] opacity-60">ก่อนหน้า</span>
            )}

            {pageNumbers.map((pageNumber, index) => {
              const previous = pageNumbers[index - 1];
              const showGap = previous !== undefined && pageNumber - previous > 1;

              return (
                <span key={pageNumber} className="inline-flex items-center gap-2">
                  {showGap && <span className="px-1 text-sm text-[var(--muted)]">…</span>}
                  <Link
                    href={buildAssetsHref(pageQuery, pageNumber)}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                    className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm font-medium transition ${
                      pageNumber === currentPage
                        ? "bg-[var(--accent-strong)] text-white"
                        : "border border-black/10 bg-white/80 hover:bg-white"
                    }`}
                  >
                    {pageNumber.toLocaleString("th-TH")}
                  </Link>
                </span>
              );
            })}

            {currentPage < totalPages ? (
              <Link href={buildAssetsHref(pageQuery, currentPage + 1)} className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-medium hover:bg-white">
                ถัดไป
              </Link>
            ) : (
              <span className="rounded-xl border border-black/6 bg-white/50 px-3 py-2 text-sm text-[var(--muted)] opacity-60">ถัดไป</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
