import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityById, listAssets, listAllFacilitiesForSelect } from "@/lib/assets";
import { formatThaiDate } from "@/lib/date-format";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { AssetFormModal } from "@/app/(main)/assets/_components/asset-form-modal";
import { DeleteAssetButton } from "@/app/(main)/assets/_components/delete-asset-button";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

function FacilityInfoCard({
  facility,
  totalAssets,
}: {
  facility: NonNullable<Awaited<ReturnType<typeof getFacilityById>>>;
  totalAssets: number;
}) {
  const items = [
    { label: "ชื่อหน่วยงาน", value: facility.name },
    { label: "ประเภท", value: facility.typecode },
    { label: "อำเภอ", value: facility.district_name },
    { label: "ตำบล", value: facility.tambon },
    { label: "พิกัด", value: facility.lat != null && facility.lon != null ? `${facility.lat}, ${facility.lon}` : "" },
    { label: "จำนวนทรัพย์สิน", value: `${totalAssets.toLocaleString("th-TH")} รายการ` },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex flex-col gap-1 border-b border-black/6 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">ข้อมูลหน่วยงาน</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">รายละเอียดหน่วยงาน</h2>
        </div>
        <StatusBadge tone="neutral">อ่านข้อมูลเท่านั้น</StatusBadge>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-xl border border-black/6 bg-white/70 px-4 py-3">
            <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]">{item.value || "–"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function FacilityDetailPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const facilityId = Number(id);
  if (!facilityId) notFound();

  if (user.role === "officer" && user.facilityId && user.facilityId !== facilityId) {
    redirect(`/facilities/${user.facilityId}`);
  }

  if (user.role === "officer" && !user.facilityId) {
    redirect("/profile");
  }

  const query = await searchParams;
  const search = readParam(query, "search");
  const statusFilter = readParam(query, "status");
  const groupFilter = readParam(query, "group");
  const workGroupFilter = Number(readParam(query, "workGroup")) || undefined;
  const deviceTypeFilter = readParam(query, "deviceType");
  const maDaysFilter = readParam(query, "maDays");
  const maExpiringDays = Number(maDaysFilter) || undefined;
  const sort = readParam(query, "sort") as "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "ma_soon";
  const normalizedSort = ["updated_desc", "updated_asc", "name_asc", "name_desc", "ma_soon"].includes(sort) ? sort : undefined;

  const [allAssets, assets, facilitiesForSelect, workGroups] = await Promise.all([
    listAssets({ facilityId }),
    listAssets({
      facilityId,
      workGroupId: workGroupFilter,
      search: search || undefined,
      status: statusFilter || undefined,
      assetGroup: groupFilter === "Hardware" || groupFilter === "Software" ? groupFilter : undefined,
      deviceType: deviceTypeFilter || undefined,
      maExpiringDays,
      sort: normalizedSort,
    }),
    listAllFacilitiesForSelect(),
    listFacilityWorkGroups(facilityId),
  ]);

  const currentFacility = await getFacilityById(facilityId);
  if (!currentFacility) notFound();

  const facilityName = allAssets[0]?.facilityName ?? currentFacility.name ?? `หน่วยงาน #${facilityId}`;
  const districtName = allAssets[0]?.districtName ?? currentFacility.district_name ?? "";

  const canManageAssets = user.role === "admin" || user.facilityId === facilityId;

  const totalAssets = allAssets.length;
  const activeCount = allAssets.filter((a) => a.currentStatus === "Active").length;
  const hardwareCount = allAssets.filter((a) => a.assetGroup === "Hardware").length;
  const softwareCount = allAssets.filter((a) => a.assetGroup === "Software").length;
  const referenceDate = new Date();
  const deviceTypeOptions = [...new Set(allAssets.map((asset) => asset.deviceType).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "th")
  );
  const hasActiveFilters = Boolean(search || statusFilter || groupFilter || workGroupFilter || deviceTypeFilter || maExpiringDays || normalizedSort);

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

      <FacilityInfoCard facility={currentFacility} totalAssets={totalAssets} />

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
          {canManageAssets && (
            <AssetFormModal facilities={facilitiesForSelect} fixedFacilityId={facilityId} updaterName={user.fullName} mode="create">
              <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                + เพิ่มทรัพย์สิน
              </button>
            </AssetFormModal>
          )}
        </div>

        <form method="GET" className="grid gap-3 border-b border-black/6 bg-[var(--neutral-bg)]/60 px-5 py-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="min-w-0 lg:col-span-2">
            <span className="sr-only">ค้นหาทรัพย์สิน</span>
            <input
              name="search"
              defaultValue={search}
              placeholder="ค้นหาชื่อ / เลขทะเบียน / Serial"
              className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-4 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </label>
          <label>
            <span className="sr-only">สถานะ</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">ทุกสถานะ</option>
              <option value="Active">พร้อมใช้งาน</option>
              <option value="Inactive">ไม่ใช้งาน</option>
              <option value="Broken">ชำรุด</option>
            </select>
          </label>
          <label>
            <span className="sr-only">หมวด</span>
            <select
              name="group"
              defaultValue={groupFilter}
              className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">ทุกหมวด</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
            </select>
          </label>
          <label>
            <span className="sr-only">ประเภทอุปกรณ์</span>
            <select
              name="deviceType"
              defaultValue={deviceTypeFilter}
              className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">ทุกประเภท</option>
              {deviceTypeOptions.map((deviceType) => (
                <option key={deviceType} value={deviceType}>{deviceType}</option>
              ))}
            </select>
          </label>
          {workGroups.length > 0 && (
            <label>
              <span className="sr-only">กลุ่มงาน</span>
              <select
                name="workGroup"
                defaultValue={workGroupFilter ?? ""}
                className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">ทุกกลุ่มงาน</option>
                {workGroups.map((workGroup) => (
                  <option key={workGroup.id} value={workGroup.id}>
                    {workGroup.workGroupName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">MA ใกล้หมดอายุ</span>
            <select
              name="maDays"
              defaultValue={maDaysFilter}
              className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">MA ทุกช่วง</option>
              <option value="30">ภายใน 30 วัน</option>
              <option value="60">ภายใน 60 วัน</option>
              <option value="90">ภายใน 90 วัน</option>
            </select>
          </label>
          <label>
            <span className="sr-only">เรียงลำดับ</span>
            <select
              name="sort"
              defaultValue={normalizedSort ?? ""}
              className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">เรียงลำดับเริ่มต้น</option>
              <option value="updated_desc">อัปเดตล่าสุด</option>
              <option value="name_asc">ชื่อ A-Z</option>
              <option value="ma_soon">MA ใกล้หมดก่อน</option>
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
            <button type="submit" className="min-h-11 rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              ค้นหา
            </button>
            {hasActiveFilters && (
              <Link href={buildFacilityHref(facilityId, {})} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm text-[var(--muted)] hover:bg-white">
                ล้างตัวกรอง
              </Link>
            )}
          </div>
        </form>

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
                    {canManageAssets && (
                      <td className="px-4 py-3 font-mono text-xs">
                        <p>{asset.privateIp || "–"}</p>
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
                          <AssetFormModal facilities={facilitiesForSelect} fixedFacilityId={facilityId} updaterName={user.fullName} mode="edit" asset={asset}>
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
