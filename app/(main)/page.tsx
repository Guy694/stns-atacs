import { isItAsset, assetTypeLabel } from "@/lib/asset-policy";
import Link from "next/link";

import { ExpiringMaintenanceTable, type ExpiringMaintenanceRow } from "@/app/(main)/_components/expiring-maintenance-table";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetStatusLabel } from "@/lib/asset-status";
import { getDashboardData } from "@/lib/atacs";
import { getCurrentUser } from "@/lib/auth";
import {
  buildDashboardAccessScope,
  inferDashboardFacilityGroup,
  matchesDashboardFacilityGroup,
  type DashboardFacilityGroup,
} from "@/lib/dashboard-access";
import { formatThaiDateTime } from "@/lib/date-format";
import { getFacilityById } from "@/lib/assets";

type HomeProps = { searchParams: Promise<Record<string, string | undefined>> };

const DISTRICT_CHART_COLORS = ["#047857", "#0e7490", "#b45309", "#dc2626", "#0f766e", "#475569", "#2563eb"];
const FACILITY_GROUP_OPTIONS: Array<{ value: DashboardFacilityGroup; label: string; description: string }> = [
  { value: "province", label: "สสจ", description: "สำนักงานสาธารณสุขจังหวัด" },
  { value: "primary-office", label: "สสอ", description: "สำนักงานสาธารณสุขอำเภอ" },
  { value: "primary-unit", label: "รพ.สต", description: "โรงพยาบาลส่งเสริมสุขภาพตำบลและหน่วยปฐมภูมิ" },
  { value: "hospital", label: "โรงพยาบาล", description: "รพ.ทั่วไปและรพ.ชุมชน" },
];
const DHO_FACILITY_GROUP_OPTIONS: Array<{ value: DashboardFacilityGroup; label: string; description: string }> = [
  { value: "primary-unit", label: "รพ.สต ในสังกัด", description: "รพ.สต/ศสช/สอน ในอำเภอเดียวกัน" },
  { value: "primary-office", label: "สสอ", description: "สำนักงานสาธารณสุขอำเภอของคุณ" },
];

function normalizeQueryValue(value?: string) {
  return value?.trim() ?? "";
}

function isDashboardFacilityGroup(
  value: string,
  options: Array<{ value: DashboardFacilityGroup }>
): value is DashboardFacilityGroup {
  return options.some((option) => option.value === value);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
}

export default async function Home({ searchParams }: HomeProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const params = await searchParams;
  const { facilitySurveys: allFacilitySurveys, districtCoverage, dataSource, connectionMessage, allowPublicOfficerBoard } =
    await getDashboardData();
  const isAdmin = currentUser.role === "admin";
  const isViewer = currentUser.role === "viewer";
  const isScopedUser = !isAdmin;
  const canViewExactInfrastructure = isAdmin;
  const canViewPublicIpPanel = isAdmin || allowPublicOfficerBoard;
  const referenceDate = new Date();
  const renderedAt = formatThaiDateTime(referenceDate);

  const ownFacility = currentUser.facilityId ? await getFacilityById(Number(currentUser.facilityId)) : null;
  const dashboardScope = buildDashboardAccessScope(
    currentUser,
    allFacilitySurveys,
    ownFacility
      ? {
          id: ownFacility.id,
          name: ownFacility.name,
          typecode: ownFacility.typecode,
          districtName: ownFacility.district_name,
        }
      : null
  );
  const missingFacilityAssignment = dashboardScope.missingFacilityAssignment;
  const selectedGroupParam = normalizeQueryValue(params.group);
  const selectedDistrict = normalizeQueryValue(params.district);
  const selectedFacilityId = (() => {
    const value = Number(params.facility);
    return Number.isInteger(value) && value > 0 ? value : null;
  })();

  const scopedFacilitySurveys = dashboardScope.surveys;
  const baseGroupOptions = dashboardScope.officerScopeKind === "district-primary" ? DHO_FACILITY_GROUP_OPTIONS : FACILITY_GROUP_OPTIONS;
  const availableGroups = new Set(
    scopedFacilitySurveys.map((survey) => inferDashboardFacilityGroup(survey.facilityTypeCode, survey.facilityName))
  );
  const groupOptions = isAdmin
    ? baseGroupOptions
    : baseGroupOptions.filter((option) =>
        option.value === "primary"
          ? availableGroups.has("primary-office") || availableGroups.has("primary-unit")
          : availableGroups.has(option.value)
      );
  const selectedGroup: DashboardFacilityGroup | "" = isDashboardFacilityGroup(selectedGroupParam, groupOptions) ? selectedGroupParam : "";
  const facilityOptions = scopedFacilitySurveys
    .filter((survey) => matchesDashboardFacilityGroup(survey.facilityTypeCode, survey.facilityName, selectedGroup))
    .filter((survey) => !selectedDistrict || survey.districtName === selectedDistrict)
    .sort((a, b) => a.districtName.localeCompare(b.districtName, "th") || a.facilityName.localeCompare(b.facilityName, "th"));
  const facilitySurveys = scopedFacilitySurveys
    .filter((survey) => matchesDashboardFacilityGroup(survey.facilityTypeCode, survey.facilityName, selectedGroup))
    .filter((survey) => !selectedDistrict || survey.districtName === selectedDistrict)
    .filter((survey) => !selectedFacilityId || survey.facilityId === selectedFacilityId);
  const districtOptions = uniqueSorted(scopedFacilitySurveys.map((survey) => survey.districtName));
  const activeFilterCount = [selectedGroup, selectedDistrict, selectedFacilityId].filter(Boolean).length;
  const selectedGroupLabel = selectedGroup
    ? groupOptions.find((option) => option.value === selectedGroup)?.label
    : "";
  const selectedFacilityName = selectedFacilityId
    ? scopedFacilitySurveys.find((survey) => survey.facilityId === selectedFacilityId)?.facilityName
    : "";

  const scopeFacilityName = isScopedUser ? dashboardScope.scopeFacilityName : null;
  const hasScopedData = scopedFacilitySurveys.length > 0;
  const hasFilteredData = facilitySurveys.length > 0;

  const allAssets = facilitySurveys.flatMap((survey) =>
    survey.assets.map((asset) => ({ ...asset, facilityName: survey.facilityName, districtName: survey.districtName }))
  );

  const totalAssets = allAssets.length;
  const safeTotalAssets = Math.max(totalAssets, 1);
  const activeAssets = allAssets.filter((a) => a.currentStatus === "Active").length;
  const brokenAssets = allAssets.filter((a) => a.currentStatus === "Broken").length;
  const inactiveAssets = allAssets.filter((a) => a.currentStatus === "Inactive").length;
  const hardwareCount = allAssets.filter((a) => isItAsset(a) && a.assetGroup === "Hardware").length;
  const softwareCount = allAssets.filter((a) => isItAsset(a) && a.assetGroup === "Software").length;
  const totalDistricts = selectedDistrict ? 1 : new Set(facilitySurveys.map((s) => s.districtName)).size;
  const activeRate = Math.round((activeAssets / safeTotalAssets) * 100);

  const deviceTypes = Object.entries(
    allAssets.reduce<Record<string, number>>((acc, asset) => {
      acc[assetTypeLabel(asset)] = (acc[assetTypeLabel(asset)] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const districtMetrics = facilitySurveys.reduce<Record<string, { assets: number; facilities: number; activeAssets: number; completionTotal: number }>>(
    (acc, survey) => {
      const cur = acc[survey.districtName] ?? { assets: 0, facilities: 0, activeAssets: 0, completionTotal: 0 };
      acc[survey.districtName] = {
        assets: cur.assets + survey.assets.length,
        facilities: cur.facilities + 1,
        activeAssets: cur.activeAssets + survey.assets.filter((a) => a.currentStatus === "Active").length,
        completionTotal: cur.completionTotal + survey.completionRate,
      };
      return acc;
    },
    {}
  );
  const districtNamesForSummary = selectedDistrict
    ? [selectedDistrict]
    : facilitySurveys.length > 0
      ? uniqueSorted(facilitySurveys.map((survey) => survey.districtName))
      : districtCoverage.map((district) => district.district);
  const districtSummary = districtNamesForSummary.map((district) => [
    district,
    {
      assets: districtMetrics[district]?.assets ?? 0,
      facilities: districtMetrics[district]?.facilities ?? 0,
      activeAssets: districtMetrics[district]?.activeAssets ?? 0,
      completionRate: districtMetrics[district]?.facilities
        ? Math.round(districtMetrics[district].completionTotal / districtMetrics[district].facilities)
        : 0,
    },
  ] as const);
  const districtCompletionTotal = districtSummary.reduce((sum, [, summary]) => sum + summary.completionRate, 0);
  const districtAverageCompletion = Math.round(districtCompletionTotal / Math.max(districtSummary.length, 1));
  const donutRadius = 44;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const districtDonutSegments = districtSummary.reduce<{
    offset: number;
    segments: Array<{
      district: string;
      summary: (typeof districtSummary)[number][1];
      color: string;
      dasharray: string;
      dashoffset: number;
    }>;
  }>(
    (acc, [district, summary], index) => {
      const length = districtCompletionTotal > 0 ? (summary.completionRate / districtCompletionTotal) * donutCircumference : 0;
      return {
        offset: acc.offset + length,
        segments: [
          ...acc.segments,
          {
            district,
            summary,
            color: DISTRICT_CHART_COLORS[index % DISTRICT_CHART_COLORS.length],
            dasharray: `${length} ${donutCircumference - length}`,
            dashoffset: -acc.offset,
          },
        ],
      };
    },
    { offset: 0, segments: [] }
  ).segments;

  const expiringSoon = allAssets
    .map((asset) => ({
      ...asset,
      daysRemaining: Math.ceil(
        (new Date(asset.maintenanceEndDate).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
    .filter((a) => a.daysRemaining >= 0 && a.daysRemaining <= 45)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  const criticalExpiringCount = expiringSoon.filter((a) => a.daysRemaining <= 7).length;
  const warningExpiringCount = expiringSoon.length - criticalExpiringCount;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const maskPublicIp = (value?: string) => {
    if (!value) return "ซ่อนข้อมูล";
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.xxx.${parts[3]}` : "ซ่อนข้อมูล";
  };

  const maskPrivateIp = (value?: string) => {
    if (!value || value === "-") return "ซ่อนข้อมูล";
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "ซ่อนข้อมูล";
  };

  const coverageTone = (rate: number) =>
    rate >= 85 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-400" : "bg-rose-500";

  const assetQuickParams = new URLSearchParams();
  if (dashboardScope.lockedFacilityId) {
    assetQuickParams.set("facility", String(dashboardScope.lockedFacilityId));
  } else if (selectedFacilityId) {
    assetQuickParams.set("facility", String(selectedFacilityId));
  } else if (selectedDistrict) {
    assetQuickParams.set("district", selectedDistrict);
  }
  const assetQuickQuery = assetQuickParams.toString();
  const assetQuickLink = assetQuickQuery ? `/assets?${assetQuickQuery}` : "/assets";
  const brokenQuickLink = `${assetQuickLink}${assetQuickLink.includes("?") ? "&" : "?"}status=Broken`;
  const activeQuickLink = `${assetQuickLink}${assetQuickLink.includes("?") ? "&" : "?"}status=Active`;
  const expiringMaintenanceRows: ExpiringMaintenanceRow[] = expiringSoon.map((asset) => ({
    id: asset.id,
    assetName: asset.assetName,
    assetRegistrationNo: asset.assetRegistrationNo,
    assetClass: asset.assetClass,
    assetGroup: asset.assetGroup,
    currentStatus: asset.currentStatus,
    daysRemaining: asset.daysRemaining,
    deviceType: asset.deviceType,
    districtName: asset.districtName,
    facilityName: asset.facilityName,
    locationDetail: canViewExactInfrastructure ? asset.locationDetail : "ภายในหน่วยงาน",
    maintenanceEndDate: asset.maintenanceEndDate,
    manufacturerBrand: asset.manufacturerBrand,
    operatingSystem: asset.operatingSystem,
    ownerName: isAdmin ? asset.ownerName : undefined,
    privateIp: canViewExactInfrastructure ? asset.privateIp : maskPrivateIp(asset.privateIp),
    publicIp: canViewPublicIpPanel ? (isAdmin ? asset.publicIp : maskPublicIp(asset.publicIp)) : undefined,
    serialNumber: isAdmin ? asset.serialNumber : undefined,
    updatedAt: asset.updatedAt,
    updatedBy: asset.updatedBy,
    usageDescription: asset.usageDescription,
  }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">

        {/* ── Page heading ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
              ATACS · Asset Tracking and Control System
            </p>
            <h1 className="section-title mt-1 text-2xl font-semibold sm:text-3xl">
              {scopeFacilityName
                ? `ภาพรวม · ${scopeFacilityName}`
                : "ภาพรวม ทะเบียนทรัพย์สินและครุภัณฑ์ สังกัด สป. จังหวัดสตูล"}
            </h1>
          </div>
          <div className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs text-[var(--muted)]">
              <span
                className={`h-2 w-2 rounded-full ${dataSource === "database" ? "bg-emerald-500" : "bg-amber-400"}`}
              />
              {connectionMessage}
            </div>
            <div className="shrink-0 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 font-mono text-xs text-[var(--accent-strong)]">
              ข้อมูลวันที่ {renderedAt}
            </div>
          </div>
        </div>

        {isViewer && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Viewer Mode: บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่ม แก้ไข หรือบันทึกการดำเนินการทรัพย์สิน
          </div>
        )}

        {missingFacilityAssignment && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            บัญชี Officer นี้ยังไม่ถูกผูกกับหน่วยงาน จึงยังไม่สามารถใช้มุมมอง &quot;รายการทรัพย์สิน&quot; ได้ กรุณาให้ผู้ดูแลระบบกำหนดหน่วยงานก่อน
          </div>
        )}

        <form method="GET" className="glass-panel rounded-2xl p-4" aria-label="ตัวกรองข้อมูลภาพรวม">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">ฟิลเตอร์ข้อมูลภาพรวม</p>
                {activeFilterCount > 0 && (
                  <StatusBadge tone="primary">{activeFilterCount} เงื่อนไข</StatusBadge>
                )}
              </div>

              {activeFilterCount > 0 && (
                <Link
                  href="/"
                  className="rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-white"
                >
                  ล้างตัวกรอง
                </Link>
              )}
            </div>

            <div className="grid min-w-0 gap-3 md:grid-cols-[1fr_1fr_1.35fr_auto] md:items-end">
              <label className="min-w-0">
                <span className="text-xs font-medium text-[var(--muted)]">กลุ่ม</span>
                <select
                  name="group"
                  defaultValue={selectedGroup}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">{dashboardScope.officerScopeKind === "district-primary" ? "ทั้งหมดในสังกัด" : "ทุกกลุ่ม"}</option>
                  {groupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="text-xs font-medium text-[var(--muted)]">หน่วยงานในอำเภอ</span>
                <select
                  name="district"
                  defaultValue={selectedDistrict}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">ทุกอำเภอ</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="text-xs font-medium text-[var(--muted)]">หน่วยงาน</span>
                <select
                  name="facility"
                  defaultValue={selectedFacilityId?.toString() ?? ""}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">ทุกหน่วยงาน</option>
                  {facilityOptions.map((facility) => (
                    <option key={facility.facilityId} value={facility.facilityId}>
                      {facility.facilityName} · {facility.districtName}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 md:mb-0"
              >
                กรองข้อมูล
              </button>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              {selectedGroupLabel && <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[var(--primary-text)]">กลุ่ม: {selectedGroupLabel}</span>}
              {selectedDistrict && <span className="rounded-full bg-white/75 px-2.5 py-1">อำเภอ: {selectedDistrict}</span>}
              {selectedFacilityName && <span className="rounded-full bg-white/75 px-2.5 py-1">หน่วยงาน: {selectedFacilityName}</span>}
            </div>
          )}
        </form>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Quick Actions</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                เปิดหน้าทำงานต่อทันทีจาก dashboard โดยใช้ตัวกรองที่เกี่ยวข้อง
              </p>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <Link href={assetQuickLink} className="shrink-0 rounded-xl border border-black/10 bg-white/80 px-4 py-2 font-medium text-[var(--foreground)] transition hover:bg-white">
                {isScopedUser ? "ไปหน้าทรัพย์สิน" : "ดูทรัพย์สินทั้งหมด"}
              </Link>
              <Link href={brokenQuickLink} className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 font-medium text-rose-700 transition hover:bg-rose-100">
                ดูรายการชำรุด
              </Link>
              <Link href="/reports?view=expiring" className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 font-medium text-amber-700 transition hover:bg-amber-100">
                ดู MA ใกล้หมดอายุ
              </Link>
              <Link href={activeQuickLink} className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 font-medium text-emerald-700 transition hover:bg-emerald-100">
                ดูรายการพร้อมใช้งาน
              </Link>
            </div>
          </div>
        </div>

        {isScopedUser && !missingFacilityAssignment && !hasScopedData && (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold text-[var(--foreground)]">ยังไม่พบข้อมูลสำรวจของหน่วยงานนี้</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              คุณสามารถเพิ่มข้อมูลทรัพย์สินของหน่วยงานที่อยู่ในสิทธิ์การดูแลได้
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href="/assets" className="rounded-xl bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                ไปหน้าทรัพย์สิน
              </Link>
            </div>
          </div>
        )}

        {(!isScopedUser || hasScopedData) && (
          !hasFilteredData ? (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <p className="text-lg font-semibold text-[var(--foreground)]">ไม่พบข้อมูลตามตัวกรองที่เลือก</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                ลองเปลี่ยนกลุ่ม อำเภอ หรือหน่วยงาน เพื่อดูข้อมูลภาพรวมชุดอื่น
              </p>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex rounded-xl border border-black/10 bg-white/80 px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
                >
                  ล้างตัวกรอง
                </Link>
              </div>
            </div>
          ) : (
          <>

        {/* ── KPI Strip ────────────────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white shadow-lg shadow-emerald-900/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">{scopeFacilityName ? "หน่วยงาน" : "หน่วยงาน"}</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{facilitySurveys.length}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {scopeFacilityName ? scopeFacilityName : `${totalDistricts} อำเภอ`}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white shadow-lg shadow-green-900/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">ทรัพย์สินรวม</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{totalAssets}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
              <span>{hardwareCount}  ฮาร์ดแวร์</span>
              <span className="text-white/30">·</span>
              <span>{softwareCount} ซอฟต์แวร์</span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 p-5 text-white shadow-lg shadow-teal-900/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">พร้อมใช้งาน</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{activeAssets}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/80" style={{ width: `${activeRate}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/60">{activeRate}% ของทั้งหมด</p>
          </div>

          <div className={`glass-panel rounded-2xl p-5 ${expiringSoon.length > 0 ? "border-amber-300/50" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">MA ใกล้หมดอายุ</p>
            <p
              className={`mt-3 text-4xl font-semibold tracking-tight ${expiringSoon.length > 0 ? "text-[var(--danger)]" : ""}`}
            >
              {expiringSoon.length}
            </p>
            <div className="mt-2 text-xs text-[var(--muted)]">
              {expiringSoon.length > 0
                ? `วิกฤต ${expiringSoon.filter((a) => a.daysRemaining <= 7).length} · เฝ้าระวัง ${expiringSoon.filter((a) => a.daysRemaining > 7).length}`
                : "ไม่มีแจ้งเตือนภายใน 45 วัน"}
            </div>
          </div>
        </div>

        {/* ── Operational + Distribution ───────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Operational Readiness */}
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Operational Readiness</p>
            <h2 className="section-title mt-1 text-xl font-semibold">สถานะการใช้งาน</h2>

            <div className="mt-5 space-y-4">
              {(
                [
	                  { label: assetStatusLabel("Active"), count: activeAssets, bar: "bg-emerald-500", bg: "bg-emerald-50", tone: "success" as const },
	                  { label: assetStatusLabel("Inactive"), count: inactiveAssets, bar: "bg-amber-400", bg: "bg-amber-50", tone: "warning" as const },
	                  { label: assetStatusLabel("Broken"), count: brokenAssets, bar: "bg-rose-500", bg: "bg-rose-50", tone: "danger" as const },
	                ] as const
	              ).map(({ label, count, bar, tone }) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className={`h-2 w-2 rounded-full ${bar}`} />
                      {label}
                    </div>
	                    <StatusBadge tone={tone}>{count}</StatusBadge>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / safeTotalAssets) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Public IP panel */}
  
          </div>

          {/* Asset Distribution */}
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Asset Distribution</p>
            <h2 className="section-title mt-1 text-xl font-semibold">ประเภทอุปกรณ์</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--accent-strong)] p-4 text-white">
                <p className="text-xs text-white/60">IT Hardware</p>
                <p className="mt-1.5 text-3xl font-semibold">{hardwareCount}</p>
                <p className="mt-0.5 text-xs text-white/60">{Math.round((hardwareCount / safeTotalAssets) * 100)}%</p>
              </div>
              <div className="rounded-xl border border-black/8 bg-white/80 p-4">
                <p className="text-xs text-[var(--muted)]">IT Software</p>
                <p className="mt-1.5 text-3xl font-semibold">{softwareCount}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{Math.round((softwareCount / safeTotalAssets) * 100)}%</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {deviceTypes.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{type}</span>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {count} / {totalAssets}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${(count / safeTotalAssets) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Provincial Coverage (admin/viewer only) ───────────────────────── */}
        {!scopeFacilityName && (
        <div className="glass-panel rounded-2xl p-6 lg:p-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Provincial Overview</p>
              <h2 className="section-title mt-1 text-xl font-semibold">ความครบถ้วนการสำรวจรายอำเภอ</h2>
            </div>
            <p className="text-xs text-[var(--muted)]">
              เขียว ≥ 85% · เหลือง ≥ 70% · แดง &lt; 70%
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.05fr]">
            {/* District progress bars */}
            <div className="space-y-3">
              {districtSummary.map(([district, summary]) => {
                const rate = summary.completionRate;
                return (
                  <div key={district} className="rounded-xl border border-black/8 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${coverageTone(rate)}`} />
                        <span className="font-semibold">{district}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted)]">
                        <span>{summary.facilities} หน่วยงาน</span>
                        <span className="font-mono font-medium text-[var(--foreground)]">{summary.assets} รายการ</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${coverageTone(rate)}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      สำรวจครบถ้วน {rate}% · พร้อมใช้งาน {summary.activeAssets} จาก {summary.assets} รายการ
                    </p>
                  </div>
                );
              })}
            </div>

            {/* District completion donut */}
            <div className="rounded-xl border border-black/8 bg-white/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">สัดส่วนรายอำเภอ</p>
                  <h3 className="mt-1 text-base font-semibold">กราฟวงกลมความครบถ้วน</h3>
                </div>
                <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                  เฉลี่ย {districtAverageCompletion}%
                </span>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
                <div className="relative mx-auto h-56 w-56">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="สัดส่วนความครบถ้วนการสำรวจรายอำเภอ">
                    <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="#e7eee9" strokeWidth="16" />
                    {districtDonutSegments.map((segment) => (
                      segment.summary.completionRate > 0 && (
                        <circle
                          key={segment.district}
                          cx="60"
                          cy="60"
                          r={donutRadius}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="16"
                          strokeDasharray={segment.dasharray}
                          strokeDashoffset={segment.dashoffset}
                          strokeLinecap="butt"
                        />
                      )
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-3xl font-semibold">{districtAverageCompletion}%</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">เฉลี่ยทั้งจังหวัด</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {districtDonutSegments.map((segment) => (
                    <div key={segment.district} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="truncate font-medium">{segment.district}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted)]">
                        <span>{segment.summary.facilities} หน่วยงาน</span>
                        <span className="w-10 text-right font-mono font-semibold text-[var(--foreground)]">{segment.summary.completionRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── MA Expiring Soon ──────────────────────────────────────────────── */}
        <ExpiringMaintenanceTable
          rows={expiringMaintenanceRows}
          criticalCount={criticalExpiringCount}
          warningCount={warningExpiringCount}
          canViewAdminFields={isAdmin}
          canViewPublicIp={canViewPublicIpPanel}
        />
          </>
          )
        )}
    </div>
  );
}
