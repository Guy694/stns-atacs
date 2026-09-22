import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";
import { getDashboardData } from "@/lib/atacs";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityById } from "@/lib/assets";
import { buildDashboardAccessScope } from "@/lib/dashboard-access";
import { CategoryBars, compactBaht, DistrictColumns, DistrictComparison, hrefWith as hrefFor, numberFormat, Panel, percent, baht, StatTile, StatusDonut } from "@/app/_components/asset-overview-charts";
import { buildDashboardSummary, readDashboardFilters } from "@/lib/dashboard-summary";
import { formatThaiDateTime } from "@/lib/date-format";
import { DashboardFilters } from "@/app/_components/dashboard-filters";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const { facilitySurveys, dataSource, connectionMessage } = await getDashboardData();
  const ownFacility = user.facilityId ? await getFacilityById(Number(user.facilityId)) : null;
  const scope = buildDashboardAccessScope(
    user,
    facilitySurveys,
    ownFacility ? { id: ownFacility.id, name: ownFacility.name, typecode: ownFacility.typecode, districtName: ownFacility.district_name } : null
  );
  const summary = buildDashboardSummary(scope.surveys, readDashboardFilters(params));
  const { filters } = summary;
  const facilityName = summary.facilityOptions.find((f) => String(f.id) === filters.facility)?.name;
  const scopeLabel = facilityName ?? (filters.district ? `อำเภอ${filters.district}` : scope.scopeFacilityName ?? "ทุกหน่วยงาน");
  const categoryLabel = summary.categoryOptions.find((c) => c.key === filters.category)?.label.replace(/^\d+\.\s*/, "");
  const cost = compactBaht(summary.totalCost);

  const assetLink = new URLSearchParams();
  if (filters.facility) assetLink.set("facility", filters.facility);
  else if (filters.district) assetLink.set("district", filters.district);
  const assetsHref = (status?: string) => {
    const query = new URLSearchParams(assetLink);
    if (status) query.set("status", status);
    return `/assets${query.size ? `?${query}` : ""}`;
  };
  const describe = [filters.fy && `ได้มาในปีงบประมาณ ${filters.fy}`, categoryLabel].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · ทะเบียนทรัพย์สินและครุภัณฑ์</p>
          <h1 className="section-title mt-1 text-2xl font-semibold sm:text-3xl">ภาพรวมครุภัณฑ์</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{scopeLabel}{describe ? ` · ${describe}` : ""} · ข้อมูล ณ {formatThaiDateTime(new Date())}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/it" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--primary-soft)]">
            <AppIcon name="monitor" className="h-4 w-4" /> แดชบอร์ด IT
          </Link>
          <Link href={`/reports?view=valuation${filters.fy ? `&fy=${filters.fy}` : ""}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]">
            <AppIcon name="file-text" className="h-4 w-4" /> รายงานมูลค่า
          </Link>
        </div>
      </header>

      {dataSource === "fallback" && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{connectionMessage}</p>
      )}
      {scope.missingFacilityAssignment && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">บัญชีของคุณยังไม่ได้ระบุหน่วยงาน <Link href="/profile" className="font-semibold underline">ตั้งค่าหน่วยงาน</Link></p>
      )}

      <DashboardFilters
        values={filters}
        fiscalYears={summary.fiscalYearOptions}
        districts={summary.districtOptions}
        facilities={summary.facilityOptions}
        categories={summary.categoryOptions}
        lockedFacility={Boolean(scope.lockedFacilityId)}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          label="ครุภัณฑ์ทั้งหมด"
          value={numberFormat.format(summary.total)}
          unit="รายการ"
          href={assetsHref()}
          detail={<>{numberFormat.format(summary.facilityCount)} หน่วยงาน · {numberFormat.format(summary.districtCount)} อำเภอ{summary.undated ? <><br />ไม่รวม {numberFormat.format(summary.undated)} รายการที่ไม่มีวันที่ได้มา</> : null}</>}
        />
        <StatTile
          label="พร้อมใช้งาน"
          value={numberFormat.format(summary.active)}
          unit="รายการ"
          href={assetsHref("Active")}
          detail={<><span className="font-semibold text-[#006300]">{percent(summary.activeRate)}</span> ของครุภัณฑ์ตามตัวกรอง · ชำรุด {numberFormat.format(summary.statuses.find((s) => s.value === "Broken")?.count ?? 0)} รายการ</>}
        />
        <StatTile
          label="มูลค่ารวม (ราคาทุน)"
          value={cost.value}
          unit={cost.unit}
          detail={<>{baht(summary.totalCost)} บาท · มีราคา {numberFormat.format(summary.priced)} จาก {numberFormat.format(summary.total)} รายการ</>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel id="category-share" title="สัดส่วนประเภทครุภัณฑ์" subtitle="จำนวนรายการตามประเภทในตารางอายุการใช้งาน · เลือกแถวเพื่อกรอง"
          action={filters.category ? <Link href={hrefFor("/dashboard", filters, { category: "" })} className="text-xs font-medium text-[var(--primary-text)] underline">ทุกประเภท</Link> : undefined}>
          <CategoryBars summary={summary} basePath="/dashboard" />
        </Panel>
        <Panel id="status-mix" title="สถานะการใช้งานครุภัณฑ์" subtitle="สัดส่วนตามสถานะปัจจุบัน">
          <StatusDonut summary={summary} />
          <div className="mt-5 grid gap-2 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {[
              { href: assetsHref("Broken"), label: "รายการชำรุด / รอซ่อม", icon: "clipboard-check" as const },
              { href: "/repairs", label: "งานซ่อมที่ค้างอยู่", icon: "wrench" as const },
              { href: "/disposal", label: "คำขอจำหน่าย / สูญหาย", icon: "archive" as const },
              { href: assetsHref("Inactive"), label: "รายการไม่ใช้งาน", icon: "package" as const },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-[var(--foreground)] transition hover:bg-[var(--primary-soft)]">
                <AppIcon name={item.icon} className="h-4 w-4 text-[var(--primary-text)]" /> {item.label} <span aria-hidden className="ml-auto text-[var(--muted)]">→</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel id="district-count" title="จำนวนครุภัณฑ์ตามอำเภอ" subtitle={filters.district ? `ทุกอำเภอตามปีงบประมาณและประเภทที่เลือก · ไฮไลต์ อ.${filters.district}` : "เลือกแท่งเพื่อดูเฉพาะอำเภอนั้น"}
        action={filters.district ? <Link href={hrefFor("/dashboard", filters, { district: "", facility: "" })} className="text-xs font-medium text-[var(--primary-text)] underline">ทุกอำเภอ</Link> : undefined}>
        <DistrictColumns summary={summary} basePath="/dashboard" />
      </Panel>

      <Panel id="district-compare" title="เปรียบเทียบรายอำเภอ" subtitle="จำนวน สถานะการใช้งาน อัตราพร้อมใช้งาน และมูลค่ารวม (ทุกอำเภอตามปีงบประมาณและประเภทที่เลือก)">
        <DistrictComparison summary={summary} basePath="/dashboard" />
      </Panel>
    </div>
  );
}
