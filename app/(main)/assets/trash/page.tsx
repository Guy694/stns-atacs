import Link from "next/link";
import { redirect } from "next/navigation";

import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { hasAssetSoftDelete } from "@/lib/asset-soft-delete";
import { listAllFacilitiesForSelect, listDeletedAssets } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { formatThaiDateTime } from "@/lib/date-format";
import { canAccessFacility, getAssetFacilityScopeIds } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { TrashTable, type TrashRow } from "./_components/trash-table";

export const metadata = { title: "ถังขยะครุภัณฑ์" };

const LIST_CAP = 500;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** ถังขยะครุภัณฑ์: soft-deleted assets an admin can restore. Admin only. */
export default async function AssetTrashPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/assets/");

  const params = await searchParams;
  const search = readParam(params, "search");
  const requestedFacility = Number(readParam(params, "facility")) || undefined;
  // Admins see every facility (undefined); a narrower scope is honoured if one is ever introduced.
  const scope = getAssetFacilityScopeIds(user);
  const facilityIds = scope === null ? [] : scope;
  const facilityId = requestedFacility && canAccessFacility(user, requestedFacility) ? requestedFacility : undefined;

  const [schemaReady, canRestore, facilities] = await Promise.all([
    hasAssetSoftDelete(),
    hasPermission(user.role, "assets.delete"),
    listAllFacilitiesForSelect(),
  ]);
  const rows = schemaReady
    ? await listDeletedAssets({ facilityId, facilityIds, search: search || undefined, limit: LIST_CAP })
    : [];
  const facilityOptions = facilities.map((facility) => ({ id: facility.id, name: facility.facility_name, typecode: facility.typecode, districtName: facility.district_name }));
  const tableRows: TrashRow[] = rows.map((row) => ({ ...row, deletedAtLabel: formatThaiDateTime(row.deletedAt) }));
  const filtered = Boolean(search || facilityId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <section className="glass-panel relative isolate flex flex-col gap-3 overflow-hidden rounded-2xl px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <PhotoBackdrop image="office-desk" opacity="opacity-[0.12]" fade="left" />
        <div>
          <nav aria-label="breadcrumb" className="mb-1 text-xs text-[var(--muted)]">
            <Link href="/assets/" className="hover:text-[var(--primary)] hover:underline">ทรัพย์สิน</Link>
            <span aria-hidden="true"> › </span>
            <span>ถังขยะ</span>
          </nav>
          <h1 className="section-title flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
            <AppIcon name="trash" className="h-7 w-7 text-[var(--primary)]" /> ถังขยะครุภัณฑ์
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ทรัพย์สินที่ถูกลบออกจากทะเบียน · {rows.length.toLocaleString("th-TH")} รายการ — กู้คืนแล้วจะกลับไปอยู่ในทะเบียนและรายงานตามเดิม
          </p>
        </div>
        <Link href="/assets/" className="secondary-action gap-2 whitespace-nowrap">
          <AppIcon name="arrow-left" className="h-4 w-4" /> กลับไปทะเบียนทรัพย์สิน
        </Link>
      </section>

      {!schemaReady ? (
        <p className="glass-panel rounded-2xl p-5 text-sm text-amber-700">
          ยังไม่ได้เปิดใช้การลบแบบเก็บประวัติ (ต้องรัน database/add_asset_soft_delete.sql) จึงยังไม่มีถังขยะ
        </p>
      ) : (
        <>
          <form method="GET" action={withBasePath("/assets/trash/")} className="glass-panel flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="trash-search" className="mb-1 block text-xs font-medium text-[var(--muted)]">ค้นหา</label>
              <input id="trash-search" name="search" type="search" defaultValue={search} placeholder="เลขครุภัณฑ์ / ชื่อ / Serial / ผู้ลบ…" className="filter-control w-full" />
            </div>
            <div className="min-w-0 md:w-80">
              <label htmlFor="trash-facility" className="mb-1 block text-xs font-medium text-[var(--muted)]">หน่วยงาน</label>
              <FacilitySelect id="trash-facility" name="facility" facilities={facilityOptions} defaultValue={facilityId ? String(facilityId) : ""} emptyLabel="ทุกหน่วยงาน" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="primary-action action-sm whitespace-nowrap"><AppIcon name="search" className="h-4 w-4" /> ค้นหา</button>
              {filtered && <Link href="/assets/trash/" className="secondary-action action-sm whitespace-nowrap">ล้างตัวกรอง</Link>}
            </div>
          </form>

          {!canRestore && (
            <p className="glass-panel rounded-2xl px-5 py-3 text-sm text-amber-700">สิทธิ์การลบ/กู้คืนทรัพย์สินถูกปิดใช้งาน — ดูรายการได้อย่างเดียว</p>
          )}

          <section className="glass-panel overflow-hidden rounded-2xl" aria-labelledby="trash-heading">
            <div className="border-b border-black/6 px-5 py-3">
              <h2 id="trash-heading" className="font-semibold">
                รายการที่ถูกลบ <span className="ml-1 text-sm font-normal text-[var(--muted)]">{rows.length.toLocaleString("th-TH")} รายการ</span>
              </h2>
            </div>
            {rows.length === 0 ? (
              <div className="relative isolate overflow-hidden px-5 py-12 text-center text-sm text-[var(--muted)]">
                <PhotoBackdrop image="office-desk" fade="bottom" />
                <AppIcon name="trash" className="mx-auto mb-2 h-8 w-8 text-[var(--primary)]" />
                <p>{filtered ? "ไม่พบทรัพย์สินที่ถูกลบตามเงื่อนไขที่ค้นหา" : "ถังขยะว่าง — ไม่มีทรัพย์สินที่ถูกลบ"}</p>
              </div>
            ) : (
              <TrashTable rows={tableRows} canRestore={canRestore} />
            )}
            {rows.length >= LIST_CAP && (
              <p className="border-t border-black/6 px-4 py-2 text-xs text-amber-700">แสดง {LIST_CAP.toLocaleString("th-TH")} รายการที่ลบล่าสุด ใช้การค้นหาเพื่อหารายการที่เก่ากว่า</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
