import Link from "next/link";

import {
  CategoryBars,
  compactBaht,
  DistrictColumns,
  DistrictComparison,
  numberFormat,
  Panel,
  percent,
  baht,
  StatTile,
  StatusDonut,
  hrefWith,
} from "@/app/_components/asset-overview-charts";
import { DashboardFilters } from "@/app/_components/dashboard-filters";
import { SplashScreen } from "@/app/_components/splash-screen";
import { SPLASH_SEEN_SCRIPT } from "@/lib/splash";
import { TopNavigation } from "@/app/_components/top-navigation";
import { AppIcon } from "@/app/_components/ui/icon";
import { getDashboardData } from "@/lib/atacs";
import { buildDashboardSummary, readDashboardFilters } from "@/lib/dashboard-summary";
import { formatThaiDateTime } from "@/lib/date-format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const BASE_PATH = "/";

/**
 * Public landing page before login. Shows aggregates only: no asset names, registration numbers,
 * serials, owners, locations or network data leave the server.
 */
export default async function PublicDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const { facilitySurveys, dataSource } = await getDashboardData();
  const summary = buildDashboardSummary(facilitySurveys, readDashboardFilters(params));
  const { filters } = summary;
  const facilityName = summary.facilityOptions.find((facility) => String(facility.id) === filters.facility)?.name;
  const scopeLabel = facilityName ?? (filters.district ? `อำเภอ${filters.district}` : "ทุกหน่วยงานใน จ.สตูล");
  const categoryLabel = summary.categoryOptions.find((category) => category.key === filters.category)?.label.replace(/^\d+\.\s*/, "");
  const describe = [filters.fy && `ได้มาในปีงบประมาณ ${filters.fy}`, categoryLabel].filter(Boolean).join(" · ");
  const cost = compactBaht(summary.totalCost);
  const broken = summary.statuses.find((status) => status.value === "Broken")?.count ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
      <SplashScreen />
      {/* Must follow the splash: hides it before first paint when this session has already seen it. */}
      <script dangerouslySetInnerHTML={{ __html: SPLASH_SEEN_SCRIPT }} />
      <TopNavigation current="public" user={null} />

      <section aria-labelledby="public-heading" className="rounded-2xl bg-[linear-gradient(135deg,#0f3d5e_0%,#15548f_60%,#1687d9_100%)] px-6 py-8 text-white sm:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-100">ATACS · สำนักงานสาธารณสุขจังหวัดสตูล</p>
            <h1 id="public-heading" className="section-title mt-3 text-3xl font-semibold leading-tight sm:text-4xl">ทะเบียนทรัพย์สินและครุภัณฑ์ จ.สตูล</h1>
            <p className="mt-3 text-sm leading-7 text-sky-50">
              ภาพรวมจำนวน สถานะการใช้งาน และมูลค่าครุภัณฑ์ของหน่วยบริการสาธารณสุขในจังหวัด แยกตามปีงบประมาณ อำเภอ หน่วยงาน และประเภท
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#15548f] transition hover:bg-sky-50">
              <AppIcon name="key" className="h-4 w-4" /> เข้าสู่ระบบสำหรับเจ้าหน้าที่
            </Link>
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl border border-white/50 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
              ลงทะเบียนผู้ใช้งาน
            </Link>
          </div>
        </div>
      </section>

      <p className="text-sm text-[var(--muted)]">
        แสดง: <span className="font-medium text-[var(--foreground)]">{scopeLabel}</span>{describe ? ` · ${describe}` : ""} · ข้อมูล ณ {formatThaiDateTime(new Date())}
      </p>
      {dataSource === "fallback" && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">ขณะนี้ไม่สามารถดึงข้อมูลล่าสุดได้ กรุณาลองใหม่ภายหลัง</p>
      )}

      <DashboardFilters
        values={filters}
        fiscalYears={summary.fiscalYearOptions}
        districts={summary.districtOptions}
        facilities={summary.facilityOptions}
        categories={summary.categoryOptions}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          label="ครุภัณฑ์ทั้งหมด"
          value={numberFormat.format(summary.total)}
          unit="รายการ"
          detail={<>{numberFormat.format(summary.facilityCount)} หน่วยงาน · {numberFormat.format(summary.districtCount)} อำเภอ{summary.undated ? <><br />ไม่รวม {numberFormat.format(summary.undated)} รายการที่ไม่มีวันที่ได้มา</> : null}</>}
        />
        <StatTile
          label="พร้อมใช้งาน"
          value={numberFormat.format(summary.active)}
          unit="รายการ"
          detail={<><span className="font-semibold text-[#006300]">{percent(summary.activeRate)}</span> ของครุภัณฑ์ตามตัวกรอง · ชำรุด {numberFormat.format(broken)} รายการ</>}
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
          action={filters.category ? <Link href={hrefWith(BASE_PATH, filters, { category: "" })} className="text-xs font-medium text-[var(--primary-text)] underline">ทุกประเภท</Link> : undefined}>
          <CategoryBars summary={summary} basePath={BASE_PATH} />
        </Panel>
        <Panel id="status-mix" title="สถานะการใช้งานครุภัณฑ์" subtitle="สัดส่วนตามสถานะปัจจุบัน">
          <StatusDonut summary={summary} />
        </Panel>
      </div>

      <Panel id="district-count" title="จำนวนครุภัณฑ์ตามอำเภอ"
        subtitle={filters.district ? `ทุกอำเภอตามปีงบประมาณและประเภทที่เลือก · ไฮไลต์ อ.${filters.district}` : "เลือกแท่งเพื่อดูเฉพาะอำเภอนั้น"}
        action={filters.district ? <Link href={hrefWith(BASE_PATH, filters, { district: "", facility: "" })} className="text-xs font-medium text-[var(--primary-text)] underline">ทุกอำเภอ</Link> : undefined}>
        <DistrictColumns summary={summary} basePath={BASE_PATH} />
      </Panel>

      <Panel id="district-compare" title="เปรียบเทียบรายอำเภอ" subtitle="จำนวน สถานะการใช้งาน อัตราพร้อมใช้งาน และมูลค่ารวม (ทุกอำเภอตามปีงบประมาณและประเภทที่เลือก)">
        <DistrictComparison summary={summary} basePath={BASE_PATH} />
      </Panel>

      <footer className="border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">
        กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล · แสดงเฉพาะข้อมูลสรุป ไม่แสดงรายละเอียดรายเครื่อง
      </footer>
    </main>
  );
}
