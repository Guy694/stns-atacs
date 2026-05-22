import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { listAssets, listAllFacilitiesForSelect, listFacilities } from "@/lib/assets";
import { listDeviceTypes } from "@/lib/device-types";
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

const STATUS_LABELS: Record<string, string> = {
  Active: "พร้อมใช้งาน",
  Inactive: "ไม่ใช้งาน",
  Broken: "ชำรุด",
};

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-stone-100 text-stone-500",
  Broken: "bg-rose-100 text-rose-700",
};

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const canViewAssets = await hasPermission(user.role, "assets.view");
  if (!canViewAssets) return null;

  const isAdmin = user.role === "admin";
  const isOfficerWithFacility = user.role === "officer" && !!user.facilityId;

  const params = await searchParams;
  const search = readParam(params, "search");
  const statusFilter = readParam(params, "status");
  const districtFilter = readParam(params, "district");
  const groupFilter = readParam(params, "group");
  const deviceTypeFilter = readParam(params, "deviceType");
  const maExpiringDays = Number(readParam(params, "maDays")) || undefined;
  const sort = readParam(params, "sort") as "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "ma_soon";
  const requestedFacilityFilter = Number(readParam(params, "facility")) || undefined;
  const facilityFilter = isOfficerWithFacility ? Number(user.facilityId) : requestedFacilityFilter;

  const [assets, facilitiesForSelect, facilities, deviceTypes] = await Promise.all([
    listAssets({
      search: search || undefined,
      status: statusFilter || undefined,
      facilityId: facilityFilter,
      district: districtFilter || undefined,
      assetGroup: groupFilter === "Hardware" || groupFilter === "Software" ? groupFilter : undefined,
      deviceType: deviceTypeFilter || undefined,
      maExpiringDays,
      sort: ["updated_desc", "updated_asc", "name_asc", "name_desc", "ma_soon"].includes(sort) ? sort : undefined,
    }),
    listAllFacilitiesForSelect(),
    listFacilities(),
    listDeviceTypes(),
  ]);

  const districtOptions = [...new Set(facilitiesForSelect.map((facility) => facility.district_name).filter(Boolean))].sort();

  const facilitiesForForm = isOfficerWithFacility
    ? facilitiesForSelect.filter((f) => f.id === Number(user.facilityId))
    : facilitiesForSelect;
  const officerFacilityName = isOfficerWithFacility
    ? facilitiesForSelect.find((f) => f.id === Number(user.facilityId))?.facility_name ?? "หน่วยงานของฉัน"
    : null;
  const canCreateAssetByPolicy = await hasPermission(user.role, "assets.create");
  const canCreateAsset = canCreateAssetByPolicy && (isAdmin || isOfficerWithFacility);
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
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS · ทะเบียนทรัพย์สิน</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">รายการทรัพย์สินสารสนเทศ</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{assets.length} รายการ</p>
          {officerFacilityName && (
            <p className="mt-2 inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              Officer Scope: {officerFacilityName}
            </p>
          )}
        </div>
        {canCreateAsset && (
          <div className="flex gap-2">
            {isAdmin && <ImportExcelModal facilities={facilities} />}
            <AssetFormModal
              facilities={facilitiesForForm}
              fixedFacilityId={isOfficerWithFacility ? Number(user.facilityId) : undefined}
              deviceTypes={deviceTypes}
              updaterName={user.fullName}
              mode="create"
            >
              <button className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                + เพิ่มทรัพย์สิน
              </button>
            </AssetFormModal>
          </div>
        )}
      </div>

      {/* Filters */}
      <form method="GET" className="glass-panel flex flex-wrap gap-3 rounded-2xl p-4">
        <input
          name="search"
          defaultValue={search}
          placeholder="ค้นหาชื่อ / เลขทะเบียน / ประเภท…"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">ทุกสถานะ</option>
          <option value="Active">พร้อมใช้งาน</option>
          <option value="Inactive">ไม่ใช้งาน</option>
          <option value="Broken">ชำรุด</option>
        </select>
        <select
          name="group"
          defaultValue={groupFilter}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">ทุกหมวด</option>
          <option value="Hardware">Hardware</option>
          <option value="Software">Software</option>
        </select>
        <select
          name="deviceType"
          defaultValue={deviceTypeFilter}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">ทุกประเภทอุปกรณ์</option>
          {deviceTypes.map((deviceType) => (
            <option key={deviceType.id + deviceType.name} value={deviceType.name}>
              {deviceType.name}
            </option>
          ))}
        </select>
        <select
          name="district"
          defaultValue={districtFilter}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">ทุกอำเภอ</option>
          {districtOptions.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
        <select
          name="maDays"
          defaultValue={maExpiringDays?.toString() ?? ""}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">MA ทุกช่วงเวลา</option>
          <option value="30">MA ภายใน 30 วัน</option>
          <option value="60">MA ภายใน 60 วัน</option>
          <option value="90">MA ภายใน 90 วัน</option>
        </select>
        {!isOfficerWithFacility && (
          <select
            name="facility"
            defaultValue={facilityFilter ?? ""}
            className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">ทุกหน่วยงาน</option>
            {facilitiesForSelect.map((f) => (
              <option key={f.id} value={f.id}>
                {f.facility_name} {f.district_name ? `· อ.${f.district_name}` : ""}
              </option>
            ))}
          </select>
        )}
        <select
          name="sort"
          defaultValue={sort || ""}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">เรียงลำดับเริ่มต้น</option>
          <option value="updated_desc">อัปเดตล่าสุดก่อน</option>
          <option value="updated_asc">อัปเดตเก่าสุดก่อน</option>
          <option value="name_asc">ชื่อ A-Z</option>
          <option value="name_desc">ชื่อ Z-A</option>
          <option value="ma_soon">MA ใกล้หมดก่อน</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          ค้นหา
        </button>
        {(search || statusFilter || requestedFacilityFilter || districtFilter || groupFilter || deviceTypeFilter || maExpiringDays || sort) && (
          <Link href="/assets" className="rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm text-[var(--muted)] hover:bg-white">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

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
                        {asset.assetRegistrationNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{asset.assetName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      <Link href={`/facilities/${asset.facilityId}`} className="hover:text-[var(--accent)] hover:underline">
                        {asset.facilityName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs">{asset.deviceType || asset.assetGroup}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[asset.currentStatus] ?? ""}`}>
                        {STATUS_LABELS[asset.currentStatus] ?? asset.currentStatus}
                      </span>
                    </td>
                    {canViewNetworkByPolicy && canSeeSensitiveAssetNetwork(user, asset.facilityId) && (
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                        {asset.privateIp || "–"}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {asset.maintenanceEndDate || "–"}
                    </td>
                    {canUpdateAssetByPolicy && canManageAsset(user, asset.facilityId) && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <AssetFormModal
                            facilities={facilitiesForForm}
                            fixedFacilityId={isOfficerWithFacility ? Number(user.facilityId) : undefined}
                            deviceTypes={deviceTypes}
                            updaterName={user.fullName}
                            mode="edit"
                            asset={asset}
                          >
                            <button className="rounded-lg border border-black/10 bg-white/80 px-3 py-1 text-xs font-medium text-[var(--accent-strong)] transition hover:bg-white">
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
    </div>
  );
}
