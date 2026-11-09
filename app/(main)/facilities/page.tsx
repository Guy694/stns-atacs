import Link from "next/link";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { listFacilities } from "@/lib/assets";
import { getAssetFacilityScopeIds } from "@/lib/facility-scope";
import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { pageHref, paginate, readPage, readSort, sortHref, sortRows } from "@/lib/table-sort";
import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { sortFacilities } from "@/lib/facility-order";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SORT_KEYS = ["name", "district", "type", "assets", "hw", "sw", "survey"] as const;

export default async function FacilitiesPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) return null;

  const facilityScopeIds = getAssetFacilityScopeIds(user);
  if (facilityScopeIds === null) return null;
  const facilities = await listFacilities(
    facilityScopeIds === undefined ? undefined : { facilityIds: facilityScopeIds }
  );

  // Group by district (district order as before); inside each district list สสจ. → สสอ. → รพท. → รพช. → รพ.สต.
  const byDistrict = facilities.reduce<Record<string, typeof facilities>>((acc, f) => {
    const district = f.district_name ?? "ไม่ระบุอำเภอ";
    (acc[district] ??= []).push(f);
    return acc;
  }, {});
  for (const district of Object.keys(byDistrict)) byDistrict[district] = sortFacilities(byDistrict[district]);

  // ค่าเริ่มต้นแสดงแยกตามอำเภอ เมื่อกดเรียงคอลัมน์จะแสดงเป็นตารางเดียวที่เรียงและแบ่งหน้า
  const params = await searchParams;
  const sort = readSort(params, SORT_KEYS);
  const sorted = sortRows(facilities, sort, {
    name: (f) => f.name,
    district: (f) => f.district_name,
    type: (f) => f.typecode,
    assets: (f) => f.asset_count,
    hw: (f) => f.hw_count,
    sw: (f) => f.sw_count,
    survey: (f) => (f.has_survey > 0 ? 1 : 0),
  });
  const paged = paginate(sorted, readPage(params));

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

  const th = (key: (typeof SORT_KEYS)[number], label: string, align: "left" | "center" = "left", className = "px-4 py-3 font-medium", firstDir: "asc" | "desc" = "asc") => (
    <SortableTh key={key} label={label} sortKey={key} sort={sort} align={align} className={className} href={sortHref("/facilities", params, key, sort, "", firstDir)} />
  );

  const renderTable = (rows: typeof facilities, start: number, showDistrict: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/5 bg-black/[0.025] text-xs text-[var(--muted)]">
            <th className="px-5 py-3 w-14 text-right font-medium">ลำดับ</th>
            {th("name", "ชื่อหน่วยบริการ", "left", "px-5 py-3 font-medium")}
            {showDistrict && th("district", "อำเภอ")}
            {th("type", "ประเภท")}
            {th("assets", "ทรัพย์สิน", "center", "px-4 py-3 font-medium", "desc")}
            {th("hw", "IT Hardware", "center", "px-4 py-3 font-medium", "desc")}
            {th("sw", "IT Software", "center", "px-4 py-3 font-medium", "desc")}
            {th("survey", "สถานะข้อมูล", "center", "px-4 py-3 font-medium", "desc")}
            <th className="px-4 py-3 text-right font-medium">รายละเอียด</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((f, rowIndex) => (
            <tr key={f.id} className="transition-colors hover:bg-black/[0.02]">
              <td className="px-5 py-3 text-right tabular-nums text-[var(--muted)]">{(start + rowIndex).toLocaleString("th-TH")}</td>
              <td className="px-5 py-3 font-medium text-[var(--foreground)]">{f.name}</td>
              {showDistrict && <td className="px-4 py-3 text-[var(--muted)]">{f.district_name ?? "ไม่ระบุอำเภอ"}</td>}
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
                  className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--primary-soft)] px-3 text-xs font-medium text-[var(--primary-text)] transition-colors duration-200 hover:bg-[var(--primary-soft-strong)]"
                >
                  {f.has_survey > 0 ? "ดูรายละเอียด" : "เริ่มกรอกข้อมูล"}
                  <AppIcon name="arrow-right" size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      {/* Header + summary numbers: one hero panel, the only place with a backdrop photo */}
      <section className="glass-panel relative isolate overflow-hidden rounded-2xl">
        <PhotoBackdrop image="meeting-room" opacity="opacity-[0.12]" fade="left" />
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <h1 className="section-title text-2xl font-semibold sm:text-3xl">หน่วยบริการสาธารณสุข</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">จังหวัดสตูล · {totalFacilities} หน่วยงาน</p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-[var(--line)] border-t border-[var(--line)]">
          <div className="px-4 py-3 sm:px-6">
            <dt className="text-xs font-medium text-[var(--muted)]">หน่วยบริการทั้งหมด</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--accent-strong)] sm:text-3xl">{totalFacilities.toLocaleString("th-TH")}</dd>
            <dd className="text-xs text-[var(--muted)]">หน่วยงาน</dd>
          </div>
          <div className="px-4 py-3 sm:px-6">
            <dt className="text-xs font-medium text-[var(--muted)]">มีข้อมูลทรัพย์สิน</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--accent-strong)] sm:text-3xl">{surveyed.toLocaleString("th-TH")}</dd>
            <dd className="text-xs text-[var(--muted)]">
              จาก {totalFacilities} หน่วยงาน ({Math.round((surveyed / (totalFacilities || 1)) * 100)}%)
            </dd>
          </div>
          <div className="px-4 py-3 sm:px-6">
            <dt className="text-xs font-medium text-[var(--muted)]">ทรัพย์สินรวม</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--accent-strong)] sm:text-3xl">{totalAssets.toLocaleString("th-TH")}</dd>
            <dd className="text-xs text-[var(--muted)]">รายการ (ฮาร์ดแวร์ + ซอฟต์แวร์)</dd>
          </div>
        </dl>
      </section>

      {/* Facility table: grouped by district by default, one flat sorted table when a column sort is chosen */}
      {sort && facilities.length > 0 && (
        <section className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 bg-[var(--accent-strong)]/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--accent-strong)]">หน่วยบริการทั้งหมด · {totalFacilities} หน่วยงาน</h2>
            <Link href="/facilities" scroll={false} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)] hover:underline"><AppIcon name="layers" size={14} /> แสดงแยกตามอำเภอ</Link>
          </div>
          {renderTable(paged.rows, paged.start, true)}
          <TablePagination {...paged} hrefFor={(page) => pageHref("/facilities", params, page)} label="แบ่งหน้าหน่วยบริการ" className="border-t border-black/6" />
        </section>
      )}

      {!sort && Object.entries(byDistrict).map(([district, facs]) => (
        <section key={district} className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/5 bg-[var(--accent-strong)]/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--accent-strong)]">
              อำเภอ{district} · {facs.length} หน่วยงาน
            </h2>
          </div>

          {renderTable(facs, 1, false)}
        </section>
      ))}

      {facilities.length === 0 && (
        <div className="glass-panel relative isolate flex flex-col items-center justify-center overflow-hidden rounded-2xl py-20 text-center">
          <PhotoBackdrop image="office-desk" opacity="opacity-[0.10]" fade="bottom" />
          <AppIcon name="building" aria-hidden="true" className="mx-auto h-10 w-10 text-[var(--muted)]" />
          <p className="mt-3 font-medium text-[var(--foreground)]">ยังไม่พบข้อมูลหน่วยบริการ</p>
          <p className="mt-1 text-sm text-[var(--muted)]">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p>
        </div>
      )}
    </div>
  );
}
