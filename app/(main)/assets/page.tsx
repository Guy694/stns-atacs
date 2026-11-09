import { AssetFilters } from "./_components/asset-filters";
import { listAssetSubtypes } from "@/lib/asset-extensions";
import { isItAsset } from "@/lib/asset-policy";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { AppIcon } from "@/app/_components/ui/icon";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { assetClassLabel } from "@/lib/asset-classes";
import { getCurrentUser } from "@/lib/auth";
import { ASSET_SORT_KEYS, countAssets, listAssets, listAllFacilitiesForSelect, listFacilities, type AssetListFilter } from "@/lib/assets";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { columnSortOption, readSort, sortHref } from "@/lib/table-sort";
import { formatThaiDate } from "@/lib/date-format";
import { listActiveDeviceTypes } from "@/lib/device-types";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { canManageAsset, canSeeSensitiveAssetNetwork } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { AssetFormModal } from "./_components/asset-form-modal";
import { listAssetLocations } from "@/lib/asset-locations";
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
    const ownFacilityId = user.facilityId ?? (user.managedAssetFacilityIds?.length === 1 ? user.managedAssetFacilityIds[0] : null);
    if (ownFacilityId) redirect(`/facilities/${ownFacilityId}`);
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
  const columnSort = readSort(params, ASSET_SORT_KEYS);
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
    orderBy: columnSort ?? undefined,
  };

  const [totalAssets, facilitiesForSelect, facilities, deviceTypes, workGroups, subtypes, assetLocations] = await Promise.all([
    countAssets(assetFilter),
    listAllFacilitiesForSelect(),
    listFacilities(),
    listActiveDeviceTypes(),
    listFacilityWorkGroups(),
    listAssetSubtypes(),
    listAssetLocations(),
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
    dir: columnSort?.dir,
    perPage: perPage === 25 ? undefined : perPage,
  };

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
  // (a column sort shows one flat table so the chosen order is not split by district)
  const byDistrict = columnSort
    ? { "": assets }
    : assets.reduce<Record<string, typeof assets>>((acc, a) => {
        (acc[a.districtName] ??= []).push(a);
        return acc;
      }, {});
  const th = (key: string, label: string) => (
    <SortableTh key={key} label={label} sortKey={key} sort={columnSort} href={sortHref("/assets", params, key, columnSort)} className="whitespace-nowrap px-3 py-2 font-medium" />
  );
  // ลำดับที่ต่อเนื่องทั้งรายการตามลำดับที่แสดงบนจอ (ต่อจากหน้าก่อน ไม่เริ่มใหม่ในแต่ละอำเภอ)
  const rowNumber = new Map(Object.values(byDistrict).flat().map((asset, index) => [asset.id, offset + index + 1]));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">

      {/* Header: the only place on this page with a backdrop photo (never behind the table or filters) */}
      <section className="glass-panel relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <PhotoBackdrop image="it-storage" opacity="opacity-[0.12]" fade="left" />
        <div>
          <h1 className="section-title text-2xl font-semibold sm:text-3xl">รายการครุภัณฑ์และทรัพย์สิน</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ทะเบียนทรัพย์สิน · {totalAssets.toLocaleString("th-TH")} รายการ
            {totalAssets > 0 && (
              <span> · แสดง {pageStart.toLocaleString("th-TH")}–{pageEnd.toLocaleString("th-TH")}</span>
            )}
          </p>
        </div>
        {(canManageSubtypes || canCreateAsset || isAdmin) && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {isAdmin && (
              <Link href="/assets/trash/" className="secondary-action gap-2 whitespace-nowrap" title="ทรัพย์สินที่ถูกลบ — กู้คืนได้">
                <AppIcon name="trash" className="h-4 w-4" /> ถังขยะ
              </Link>
            )}
            {canManageSubtypes && (
              <Link href="/assets/subtypes" className="secondary-action gap-2 whitespace-nowrap">
                <AppIcon name="tag" className="h-4 w-4" /> จัดการประเภทย่อย
              </Link>
            )}
            {canCreateAsset && isAdmin && <ImportExcelModal facilities={facilities} workGroups={workGroups} />}
            {canCreateAsset && (
              <AssetFormModal
                facilities={facilitiesForForm}
                deviceTypes={deviceTypes}
                workGroups={workGroups}
                locations={assetLocations}
                updaterName={user.fullName}
                mode="create"
              >
                <button type="button" className="primary-action whitespace-nowrap">
                  <AppIcon name="plus" className="h-4 w-4" /> เพิ่มทรัพย์สิน
                </button>
              </AssetFormModal>
            )}
          </div>
        )}
      </section>

      <AssetFilters key={JSON.stringify(pageQuery)} values={pageQuery} resetHref="/assets" subtypes={subtypes} deviceTypes={deviceTypes} facilities={facilitiesForSelect} districts={districtOptions} workGroups={workGroups} paginate columnSort={columnSortOption(columnSort, { reg: "เลขทะเบียน", name: "ชื่อทรัพย์สิน", facility: "หน่วยงาน", type: "ประเภท", status: "สถานะ", ...(canViewNetworkByPolicy ? { ip: "IP" } : {}), ma: "MA หมด" })} />

      {/* Table by district */}
      {Object.entries(byDistrict).map(([district, items]) => (
        <div key={district} className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-black/6 px-4 py-2.5 sm:px-5">
            <div>
              <span className="font-semibold">{district ? `อ.${district}` : "ทุกอำเภอ"}</span>
              <span className="ml-2 text-sm text-[var(--muted)]">{items.length} รายการ</span>
            </div>
          </div>

          {/* D2: มือถือแสดงเป็นการ์ด ตารางแสดงตั้งแต่ md ขึ้นไป */}
          <ul className="divide-y divide-black/6 md:hidden">
            {items.map((asset) => {
              const canEdit = canUpdateAssetByPolicy && canManageAsset(user, asset.facilityId);
              const showIp = canViewNetworkByPolicy && canSeeSensitiveAssetNetwork(user, asset.facilityId) && isItAsset(asset) && asset.privateIp;
              return (
                <li key={asset.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/assets/${asset.id}`} className="font-semibold leading-snug text-[var(--accent-strong)] underline-offset-4 hover:underline">
                        {asset.assetName}
                      </Link>
                      <p className="mt-0.5 break-all font-mono text-xs text-[var(--muted)]">{asset.assetNumber || `#${asset.id}`}</p>
                    </div>
                    <StatusBadge className="shrink-0 whitespace-nowrap" tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                      {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                    </StatusBadge>
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[var(--muted)]">หน่วยงาน</dt>
                    <dd className="min-w-0">
                      <Link href={`/facilities/${asset.facilityId}`} className="hover:text-[var(--accent)] hover:underline">{asset.facilityName}</Link>
                    </dd>
                    <dt className="text-[var(--muted)]">ประเภท</dt>
                    <dd className="min-w-0">
                      {assetClassLabel(asset.assetClass)}
                      <span className="text-[var(--muted)]"> · {isItAsset(asset) ? asset.deviceType || asset.assetGroup : "ทะเบียนทรัพย์สิน"}</span>
                    </dd>
                    {showIp && (
                      <>
                        <dt className="text-[var(--muted)]">IP</dt>
                        <dd className="font-mono">{asset.privateIp}</dd>
                      </>
                    )}
                    <dt className="text-[var(--muted)]">MA หมด</dt>
                    <dd>{formatThaiDate(asset.maintenanceEndDate)}</dd>
                  </dl>
                  {canEdit && (
                    <div className="mt-2 flex justify-end gap-2">
                      <AssetFormModal
                        facilities={facilitiesForForm}
                        deviceTypes={deviceTypes}
                        workGroups={workGroups}
                        locations={assetLocations}
                        updaterName={user.fullName}
                        mode="edit"
                        asset={asset}
                      >
                        <ActionIconButton icon="pencil" label={`แก้ไข ${asset.assetName}`} />
                      </AssetFormModal>
                      <DeleteAssetButton assetId={asset.id} assetName={asset.assetName} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                  <th className="w-12 whitespace-nowrap px-3 py-2 text-right font-medium">ลำดับ</th>
                  {th("reg", "เลขทะเบียน")}
                  {th("name", "ชื่อทรัพย์สิน")}
                  {th("facility", "หน่วยงาน")}
                  {th("type", "ประเภท")}
                  {th("status", "สถานะ")}
                  {canViewNetworkByPolicy && th("ip", "IP")}
                  {th("ma", "MA หมด")}
                  {canUpdateAssetByPolicy && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {items.map((asset) => (
                  <tr key={asset.id} className="hover:bg-white/50 transition">
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--muted)]">{(rowNumber.get(asset.id) ?? 0).toLocaleString("th-TH")}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={`/assets/${asset.id}`} className="font-mono text-xs text-[var(--accent)] hover:underline">
                        {asset.assetNumber || `#${asset.id}`}
                      </Link>
                    </td>
                    <td className="min-w-48 px-3 py-2 font-medium">{asset.assetName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">
                      <Link href={`/facilities/${asset.facilityId}`} className="hover:text-[var(--accent)] hover:underline">
                        {asset.facilityName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-36 flex-col items-start gap-0.5">
                        <StatusBadge tone="primary" className="whitespace-nowrap">{assetClassLabel(asset.assetClass)}</StatusBadge>
                        <span className="text-xs text-[var(--muted)]">{isItAsset(asset) ? asset.deviceType || asset.assetGroup : "ทะเบียนทรัพย์สิน"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge className="whitespace-nowrap" tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                      </StatusBadge>
                    </td>
                    {canViewNetworkByPolicy && canSeeSensitiveAssetNetwork(user, asset.facilityId) && (
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--muted)]">
                        {isItAsset(asset) ? asset.privateIp || "–" : "–"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--muted)]">
                      {formatThaiDate(asset.maintenanceEndDate)}
                    </td>
                    {canUpdateAssetByPolicy && canManageAsset(user, asset.facilityId) && (
                      <td className="px-3 py-1.5 text-right">
                        <div className="inline-flex gap-1.5">
                          <AssetFormModal
                            facilities={facilitiesForForm}
                            deviceTypes={deviceTypes}
                            workGroups={workGroups}
                            locations={assetLocations}
                            updaterName={user.fullName}
                            mode="edit"
                            asset={asset}
                          >
                            <ActionIconButton icon="pencil" label={`แก้ไข ${asset.assetName}`} />
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
        <div className="glass-panel relative isolate flex flex-col items-center overflow-hidden rounded-2xl px-6 py-14 text-center">
          <PhotoBackdrop image="office-desk" opacity="opacity-[0.10]" fade="bottom" />
          <AppIcon name="package" size={36} className="text-[var(--muted)]" />
          <p className="mt-3 font-medium text-[var(--foreground)]">ไม่พบรายการทรัพย์สินที่ตรงกับเงื่อนไข</p>
          <p className="mt-1 text-sm text-[var(--muted)]">ลองเปลี่ยนคำค้นหรือล้างตัวกรอง</p>
        </div>
      )}

      {totalAssets > 0 && (
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          total={totalAssets}
          start={pageStart}
          end={pageEnd}
          hrefFor={(page) => buildAssetsHref(pageQuery, page)}
          label="แบ่งหน้ารายการทรัพย์สิน"
          className="glass-panel rounded-2xl"
        />
      )}
    </div>
  );
}
