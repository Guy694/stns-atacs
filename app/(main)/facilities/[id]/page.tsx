import { AssetFilters } from "@/app/(main)/assets/_components/asset-filters";
import { listAssetSubtypes } from "@/lib/asset-extensions";
import { isItAsset } from "@/lib/asset-policy";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { ActionIconButton, ActionIconLink } from "@/app/_components/ui/action-icon-button";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
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
import { listAssetLocations } from "@/lib/asset-locations";
import { DeleteAssetButton } from "@/app/(main)/assets/_components/delete-asset-button";
import { FacilityAssetQrActions } from "@/app/(main)/facilities/[id]/_components/facility-asset-qr-actions";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { columnSortOption, pageHref, paginate, readPage, readSort, sortHref, sortRows, type SortState } from "@/lib/table-sort";

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
const STATUS_RANK: Record<string, number> = { Active: 0, Inactive: 1, Broken: 2, Lost: 3, Disposed: 4 };
// ค่าเรียงลำดับเดิมจากตัวกรอง (?sort=name_asc ฯลฯ) ที่ตรงกับคอลัมน์ในตาราง
const LEGACY_COLUMN_SORT: Record<string, SortState> = {
  name_asc: { key: "name", dir: "asc" },
  name_desc: { key: "name", dir: "desc" },
  ma_soon: { key: "ma", dir: "asc" },
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
  const assetLocations = await listAssetLocations(facilityId);
  const [canCreateAsset, canUpdateAsset] = await Promise.all([
    hasPermission(user.role, "assets.create"),
    hasPermission(user.role, "assets.update"),
  ]);

  // ตารางเรียง/แบ่งหน้าในหน่วยความจำ: หัวคอลัมน์ (?sort=<คอลัมน์>) มาก่อน ถ้าไม่มีใช้ค่าจากตัวกรองเดิม
  const columnKeys = ["number", "name", "class", "status", "ma", ...(canManageAssets ? ["ip", "serial"] : [])];
  const tableSort = readSort(query, columnKeys) ?? (normalizedSort ? LEGACY_COLUMN_SORT[normalizedSort] ?? null : null);
  const sortedAssets = sortRows(assets, tableSort, {
    number: (a) => a.assetNumber || `#${a.id}`,
    name: (a) => a.assetName,
    class: (a) => assetClassLabel(a.assetClass),
    status: (a) => STATUS_RANK[a.currentStatus] ?? 9,
    ip: (a) => (isItAsset(a) ? a.privateIp : "") || a.locationDetail,
    serial: (a) => a.serialNumber,
    ma: (a) => a.maintenanceEndDate,
  });
  const paged = paginate(sortedAssets, readPage(query));
  const basePath = `/facilities/${facilityId}`;
  const th = (key: string, label: string) => (
    <SortableTh key={key} label={label} sortKey={key} sort={tableSort} href={sortHref(basePath, query, key, tableSort)} className="whitespace-nowrap px-3 py-2 font-medium" />
  );

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
      <nav aria-label="เส้นทางนำทาง" className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
        {user.role === "officer" ? (
          <span>รายการทรัพย์สิน</span>
        ) : (
          <Link href="/assets" className="hover:text-[var(--accent)]">ทะเบียนทรัพย์สิน</Link>
        )}
        <AppIcon name="chevron-right" size={14} />
        <span className="text-[var(--foreground)]">{facilityName}</span>
      </nav>

      {/* Hero */}
      <div className="glass-panel relative isolate overflow-hidden rounded-2xl">
        <PhotoBackdrop image="meeting-room" opacity="opacity-[0.12]" fade="left" />
        <div className="px-5 py-6 sm:px-6">
          <h1 className="section-title text-2xl font-semibold sm:text-3xl">{facilityName}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <AppIcon name="building" size={15} /> หน่วยบริการ{districtName ? ` · อ.${districtName}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)] sm:grid-cols-4">
          {[
            { label: "ทรัพย์สินรวม", value: totalAssets },
            { label: "พร้อมใช้งาน", value: activeCount, green: true },
            { label: "IT Hardware", value: hardwareCount },
            { label: "IT Software", value: softwareCount },
          ].map((kpi) => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="text-xs text-[var(--muted)]">{kpi.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpi.green ? "text-[var(--accent-strong)]" : ""}`}>{kpi.value.toLocaleString("th-TH")}</p>
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
          <div className="flex flex-wrap items-center gap-2">
            {canManageAssets && (canCreateAsset || canUpdateAsset) && (
              <ImportExcelModal
                facilities={[{ id: facilityId, name: facilityName, district_name: currentFacility.district_name }]}
                workGroups={workGroups}
                fixedFacilityId={facilityId}
              />
            )}
            <ActionIconLink href={`/print/assets/register?facility=${facilityId}`} icon="file-text" label="พิมพ์ทะเบียนคุมทรัพย์สิน (A4 แนวนอน)" />
            <ActionIconLink href={`/print/assets/audit?facility=${facilityId}`} icon="clipboard-check" label="พิมพ์ใบตรวจสอบพัสดุประจำปี (A4 แนวนอน)" />
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
                locations={assetLocations}
                fixedFacilityId={facilityId}
                updaterName={user.fullName}
                mode="create"
              >
                <button type="button" className="primary-action whitespace-nowrap">
                  <AppIcon name="plus" className="h-4 w-4" /> เพิ่มทรัพย์สิน
                </button>
              </AssetFormModal>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <AssetFilters key={JSON.stringify(query)} resetHref={buildFacilityHref(facilityId, {})} values={{ search, status: statusFilter, assetClass: assetClassFilter, subtype: subtypeFilter, group: groupFilter, deviceType: deviceTypeFilter, workGroup: workGroupFilter, maDays: maDaysFilter, sort: normalizedSort }} subtypes={subtypes} deviceTypes={deviceTypes} workGroups={workGroups} columnSort={readSort(query, columnKeys) ? columnSortOption(tableSort, { number: "เลขทะเบียน", name: "ชื่อทรัพย์สิน", class: "ประเภท", status: "สถานะ", ...(canManageAssets ? { ip: "IP / ที่ตั้ง", serial: "Serial" } : {}), ma: "MA หมด" }) : null} />
        </div>

        {assets.length === 0 ? (
          <div className="relative isolate flex flex-col items-center overflow-hidden border-t border-black/6 px-6 py-12 text-center">
            <PhotoBackdrop image="office-desk" opacity="opacity-[0.10]" fade="bottom" />
            <AppIcon name="package" size={32} className="text-[var(--muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">ไม่พบรายการทรัพย์สินที่ตรงกับเงื่อนไข</p>
            <p className="mt-1 text-xs text-[var(--muted)]">ลองเปลี่ยนคำค้นหรือล้างตัวกรอง</p>
          </div>
        ) : (
          <>
            {/* D2: มือถือแสดงเป็นการ์ด ตารางแสดงตั้งแต่ md ขึ้นไป (เรียงลำดับบนมือถือใช้ตัวเลือกในตัวกรองเพิ่มเติม) */}
            <ul className="divide-y divide-black/6 border-t border-black/6 md:hidden">
              {paged.rows.map((asset) => (
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
                  {asset.usageDescription && <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{asset.usageDescription}</p>}
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[var(--muted)]">ประเภท</dt>
                    <dd className="min-w-0">
                      {assetClassLabel(asset.assetClass)}
                      {isItAsset(asset) && <span className="text-[var(--muted)]"> · {asset.deviceType || asset.assetGroup}</span>}
                    </dd>
                    {canManageAssets && ((isItAsset(asset) && asset.privateIp) || asset.locationDetail) && (
                      <>
                        <dt className="text-[var(--muted)]">IP / ที่ตั้ง</dt>
                        <dd className="min-w-0 break-words">
                          {isItAsset(asset) && asset.privateIp && <span className="font-mono">{asset.privateIp}</span>}
                          {isItAsset(asset) && asset.privateIp && asset.locationDetail && " · "}
                          {asset.locationDetail}
                        </dd>
                      </>
                    )}
                    {canManageAssets && asset.serialNumber && (
                      <>
                        <dt className="text-[var(--muted)]">Serial</dt>
                        <dd className="min-w-0 break-all font-mono">{asset.serialNumber}</dd>
                      </>
                    )}
                    <dt className="text-[var(--muted)]">MA หมด</dt>
                    <dd>{formatThaiDate(asset.maintenanceEndDate)}</dd>
                  </dl>
                  {canManageAssets && (
                    <div className="mt-2 flex justify-end gap-2">
                      <AssetFormModal
                        facilities={facilitiesForSelect}
                        deviceTypes={deviceTypes}
                        workGroups={workGroups}
                        locations={assetLocations}
                        fixedFacilityId={facilityId}
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
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                    <th className="w-12 whitespace-nowrap px-3 py-2 text-right font-medium">ลำดับ</th>
                    {th("number", "เลขทะเบียน")}
                    {th("name", "ชื่อทรัพย์สิน")}
                    {th("class", "ประเภท")}
                    {th("status", "สถานะ")}
                    {canManageAssets && th("ip", "IP / ที่ตั้ง")}
                    {canManageAssets && th("serial", "Serial")}
                    {th("ma", "MA หมด")}
                    {canManageAssets && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/4">
                  {paged.rows.map((asset, rowIndex) => (
                    <tr key={asset.id} className="transition hover:bg-white/50">
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--muted)]">{(paged.start + rowIndex).toLocaleString("th-TH")}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-mono text-xs font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
                        >
                          {asset.assetNumber || `#${asset.id}`}
                        </Link>
                      </td>
                      <td className="min-w-48 px-3 py-2">
                        <p className="font-medium">{asset.assetName}</p>
                        {asset.usageDescription && (
                          <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-1">{asset.usageDescription}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone="primary" className="whitespace-nowrap">{assetClassLabel(asset.assetClass)}</StatusBadge>
                        {isItAsset(asset) && <p className="mt-0.5 whitespace-nowrap text-xs">{asset.deviceType || "–"} <span className="text-[var(--muted)]">· {asset.assetGroup}</span></p>}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge className="whitespace-nowrap" tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                          {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                        </StatusBadge>
                      </td>
                      {canManageAssets && (
                        <td className="min-w-32 px-3 py-2 text-xs">
                          <p className="whitespace-nowrap font-mono">{isItAsset(asset) ? asset.privateIp || "–" : "–"}</p>
                          {asset.locationDetail && <p className="text-[var(--muted)]">{asset.locationDetail}</p>}
                        </td>
                      )}
                      {canManageAssets && (
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--muted)]">{asset.serialNumber || "–"}</td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--muted)]">{formatThaiDate(asset.maintenanceEndDate)}</td>
                      {canManageAssets && (
                        <td className="px-3 py-1.5 text-right">
                          <div className="inline-flex gap-1.5">
                            <AssetFormModal
                              facilities={facilitiesForSelect}
                              deviceTypes={deviceTypes}
                              workGroups={workGroups}
                              locations={assetLocations}
                              fixedFacilityId={facilityId}
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
          </>
        )}
        <TablePagination {...paged} hrefFor={(page) => pageHref(basePath, query, page)} label="แบ่งหน้ารายการทรัพย์สิน" className="border-t border-black/6" />
      </div>
    </div>
  );
}
