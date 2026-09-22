import type { AssetRecord, FacilitySurvey } from "@/app/atacs-data";
import { dashboardCategoryId, DEPRECIATION_CATEGORIES } from "@/lib/asset-depreciation";
import { fiscalYearOf } from "@/lib/asset-valuation";
import { overviewStatus, type OverviewStatus } from "@/lib/dashboard-overview";

/** Status order and colours: the fixed status palette, always shown with a text label. */
export const DASHBOARD_STATUSES: Array<{ value: OverviewStatus; label: string; color: string }> = [
  { value: "Active", label: "พร้อมใช้งาน", color: "#0ca30c" },
  { value: "Broken", label: "ชำรุด / รอซ่อม", color: "#ec835a" },
  { value: "Inactive", label: "ไม่ใช้งาน", color: "#fab219" },
  { value: "Lost", label: "สูญหาย", color: "#d03b3b" },
  { value: "Disposed", label: "จำหน่ายแล้ว", color: "#898781" },
  { value: "Unknown", label: "ยังไม่ระบุ", color: "#c3c2b7" },
];

export type DashboardFilters = { fy: string; district: string; facility: string; category: string };

export function readDashboardFilters(params: Record<string, string | string[] | undefined>): DashboardFilters {
  const read = (key: string) => { const value = params[key]; return ((Array.isArray(value) ? value[0] : value) ?? "").trim(); };
  const fy = read("fy");
  return {
    fy: /^\d{4}$/.test(fy) ? fy : "",
    district: read("district"),
    facility: /^\d+$/.test(read("facility")) ? read("facility") : "",
    category: /^(\d{1,2}|unclassified)$/.test(read("category")) ? read("category") : "",
  };
}

const isDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

/** Fiscal year (B.E.) in which the asset was acquired: purchase/receipt date, else installation date. */
export function acquisitionFiscalYear(asset: Pick<AssetRecord, "purchaseDate" | "installedAt">) {
  const date = isDate(asset.purchaseDate) ? asset.purchaseDate! : isDate(asset.installedAt) ? asset.installedAt! : "";
  return date ? fiscalYearOf(date) : null;
}

type StatusCounts = Record<OverviewStatus, number>;
const emptyStatusCounts = (): StatusCounts => ({ Active: 0, Broken: 0, Inactive: 0, Lost: 0, Disposed: 0, Unknown: 0 });

export type FacilityBreakdown = { id: number; name: string; total: number; cost: number; statuses: StatusCounts };
export type DistrictRow = { district: string; facilities: number; total: number; cost: number; statuses: StatusCounts; facilityRows: FacilityBreakdown[] };

/** Input surveys must already be limited to what the user may see. */
export function buildDashboardSummary(scopedSurveys: FacilitySurvey[], filters: DashboardFilters, today = new Date().toISOString().slice(0, 10)) {
  const districtOptions = [...new Set(scopedSurveys.map(survey => survey.districtName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const district = districtOptions.includes(filters.district) ? filters.district : "";
  const facilityOptions = scopedSurveys
    .filter(survey => !district || survey.districtName === district)
    .map(survey => ({ id: survey.facilityId, name: survey.facilityName, district: survey.districtName }))
    .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
    .sort((a, b) => a.district.localeCompare(b.district, "th") || a.name.localeCompare(b.name, "th"));
  const facility = facilityOptions.some(item => String(item.id) === filters.facility) ? filters.facility : "";

  const years = new Set<number>([fiscalYearOf(today)]);
  for (const survey of scopedSurveys) for (const asset of survey.assets) {
    const year = acquisitionFiscalYear(asset);
    if (year) years.add(year);
  }
  const fiscalYearOptions = [...years].sort((a, b) => b - a);
  const fy = filters.fy && years.has(Number(filters.fy)) ? filters.fy : "";

  const inScope = (survey: FacilitySurvey) => (!district || survey.districtName === district) && (!facility || String(survey.facilityId) === facility);
  const surveys = scopedSurveys.filter(inScope);
  let undated = 0;
  // Fiscal-year and category filters apply everywhere; district/facility narrow the KPIs and charts but the
  // district comparison keeps every district so the selected one can still be compared with the others.
  const baseItems = scopedSurveys.flatMap(survey => survey.assets.map(asset => {
    const categoryId = dashboardCategoryId(asset);
    return { asset, survey, categoryKey: categoryId === null ? "unclassified" : String(categoryId), status: overviewStatus(asset), fiscalYear: acquisitionFiscalYear(asset) };
  })).filter(item => {
    if (fy && item.fiscalYear === null) { if (inScope(item.survey)) undated += 1; return false; }
    return (!fy || String(item.fiscalYear) === fy) && (!filters.category || item.categoryKey === filters.category);
  });
  const assets = baseItems.filter(item => inScope(item.survey));

  const statusCounts = emptyStatusCounts();
  let totalCost = 0;
  let priced = 0;
  const categoryMap = new Map<string, { count: number; cost: number }>();
  const districtMap = new Map<string, DistrictRow>();
  const facilityMap = new Map<number, FacilityBreakdown>();
  for (const name of districtOptions) {
    const facilityRows: FacilityBreakdown[] = [];
    for (const survey of scopedSurveys) {
      if (survey.districtName !== name || facilityMap.has(survey.facilityId)) continue;
      const row = { id: survey.facilityId, name: survey.facilityName, total: 0, cost: 0, statuses: emptyStatusCounts() };
      facilityMap.set(survey.facilityId, row);
      facilityRows.push(row);
    }
    districtMap.set(name, { district: name, facilities: facilityRows.length, total: 0, cost: 0, statuses: emptyStatusCounts(), facilityRows });
  }
  const costOf = (price: number | null | undefined) => (typeof price === "number" && Number.isFinite(price) ? price : 0);
  for (const item of assets) {
    statusCounts[item.status] += 1;
    const price = item.asset.purchasePrice;
    if (typeof price === "number" && Number.isFinite(price)) { priced += 1; totalCost += price; }
    const category = categoryMap.get(item.categoryKey) ?? { count: 0, cost: 0 };
    category.count += 1; category.cost += costOf(price);
    categoryMap.set(item.categoryKey, category);
  }
  for (const item of baseItems) {
    const row = districtMap.get(item.survey.districtName);
    const facilityRow = facilityMap.get(item.survey.facilityId);
    for (const target of [row, facilityRow]) {
      if (target) { target.total += 1; target.cost += costOf(item.asset.purchasePrice); target.statuses[item.status] += 1; }
    }
  }
  const total = assets.length;
  const labelFor = (key: string) => key === "unclassified" ? "รอตรวจสอบประเภท" : DEPRECIATION_CATEGORIES.find(category => String(category.id) === key)?.label ?? key;
  const categories = [...categoryMap.entries()]
    .map(([key, value]) => ({ key, label: labelFor(key), count: value.count, cost: Math.round(value.cost * 100) / 100, share: total ? value.count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));

  return {
    filters: { fy, district, facility, category: filters.category },
    fiscalYearOptions,
    districtOptions,
    facilityOptions,
    categoryOptions: [...DEPRECIATION_CATEGORIES.map(category => ({ key: String(category.id), label: `${category.id}. ${category.label}` })), { key: "unclassified", label: "รอตรวจสอบประเภท" }],
    total,
    active: statusCounts.Active,
    activeRate: total ? statusCounts.Active / total : 0,
    totalCost: Math.round(totalCost * 100) / 100,
    priced,
    undated,
    statuses: DASHBOARD_STATUSES.map(status => ({ ...status, count: statusCounts[status.value], share: total ? statusCounts[status.value] / total : 0 })),
    categories,
    districts: [...districtMap.values()].map(row => ({
      ...row,
      cost: Math.round(row.cost * 100) / 100,
      facilityRows: row.facilityRows
        .map(facility => ({ ...facility, cost: Math.round(facility.cost * 100) / 100 }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "th")),
    })),
    facilityCount: new Set(surveys.map(survey => survey.facilityId)).size,
    districtCount: new Set(surveys.map(survey => survey.districtName)).size,
  };
}

export type DashboardSummary = ReturnType<typeof buildDashboardSummary>;
