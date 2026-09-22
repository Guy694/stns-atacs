import type { AssetRecord, FacilitySurvey } from "@/app/atacs-data";
import { dashboardCategoryId, DEPRECIATION_CATEGORIES } from "@/lib/asset-depreciation";
import { assetClassLabel } from "@/lib/asset-classes";
import { matchesDashboardFacilityGroup, type DashboardFacilityGroup } from "@/lib/dashboard-access";

export const OVERVIEW_STATUSES = [
  { value: "Active", label: "ใช้งานอยู่", color: "#059669" },
  { value: "Broken", label: "ชำรุด / รอซ่อม", color: "#ea580c" },
  { value: "Disposed", label: "จำหน่ายแล้ว", color: "#e11d48" },
  { value: "Inactive", label: "ไม่ใช้งาน", color: "#64748b" },
  { value: "Lost", label: "สูญหาย", color: "#7c3aed" },
  { value: "Unknown", label: "ยังไม่ระบุสถานะ", color: "#475569" },
] as const;
export type OverviewStatus = (typeof OVERVIEW_STATUSES)[number]["value"];
export type OverviewFilters = { q: string; facility: string; district: string; group: DashboardFacilityGroup | ""; category: string; status: string; page: number };
export type OverviewAsset = {
  id: number; registration: string; name: string; category: string; categoryId: string;
  status: OverviewStatus; facilityId: number; facilityName: string; district: string;
  location: string; createdAt: string;
};
export type OverviewFacility = { id: number; name: string; district: string; typecode?: string };

export function readOverviewFilters(params: Record<string, string | string[] | undefined>): OverviewFilters {
  const read = (key: string) => { const value = params[key]; return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""; };
  const group = read("group");
  return {
    q: read("q"), facility: read("facility"), district: read("district"),
    group: ["province", "primary", "primary-office", "primary-unit", "hospital"].includes(group) ? group as DashboardFacilityGroup : "",
    category: read("category"), status: read("status"),
    page: /^\d+$/.test(read("page")) ? Math.max(1, Number(read("page"))) : 1,
  };
}

export function overviewStatus(asset: Pick<AssetRecord, "currentStatus" | "usageDescription">): OverviewStatus {
  // Older disposal actions stored Inactive with these exact system-generated prefixes.
  // Never infer disposal from arbitrary prose or override an active/broken status.
  if (asset.currentStatus === "Inactive") {
    if (asset.usageDescription.startsWith("[จำหน่ายออก] ")) return "Disposed";
    if (asset.usageDescription.startsWith("[สูญหาย] ")) return "Lost";
  }
  return OVERVIEW_STATUSES.some(status => status.value === asset.currentStatus) ? asset.currentStatus as OverviewStatus : "Unknown";
}

export function overviewHref(filters: OverviewFilters, patch: Partial<OverviewFilters> = {}, anchor = "") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: 1, ...patch })) {
    if (value && !(key === "page" && value === 1)) query.set(key, String(value));
  }
  return `/dashboard${query.size ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
}

/** Input must already be authorized. Returned assets are an explicit, non-sensitive display DTO. */
export function buildDashboardOverview(scopedSurveys: FacilitySurvey[], filters: OverviewFilters) {
  const facilities: OverviewFacility[] = [...new Map(scopedSurveys.map(survey => [survey.facilityId, {
    id: survey.facilityId, name: survey.facilityName, district: survey.districtName, typecode: survey.facilityTypeCode,
  }])).values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
  const allowedSurveys = scopedSurveys.filter(survey =>
    (!filters.facility || String(survey.facilityId) === filters.facility) &&
    (!filters.district || survey.districtName === filters.district) &&
    matchesDashboardFacilityGroup(survey.facilityTypeCode, survey.facilityName, filters.group));
  const query = filters.q.toLocaleLowerCase("th");
  const assets: OverviewAsset[] = allowedSurveys.flatMap(survey => survey.assets.map(asset => {
    const categoryId = dashboardCategoryId(asset);
    return {
      id: asset.id, registration: asset.assetRegistrationNo, name: asset.assetName,
      category: DEPRECIATION_CATEGORIES.find(category => category.id === categoryId)?.label ?? assetClassLabel(asset.assetClass, "full"),
      categoryId: categoryId === null ? "unclassified" : String(categoryId),
      status: overviewStatus(asset), facilityId: survey.facilityId, facilityName: survey.facilityName,
      district: survey.districtName, location: asset.locationDetail, createdAt: asset.createdAt ?? "",
    };
  })).filter(asset => (!filters.category || filters.category === asset.categoryId) && (!filters.status || filters.status === asset.status) &&
    (!query || [asset.registration, asset.name, asset.location, asset.facilityName].some(value => value.toLocaleLowerCase("th").includes(query))));
  const total = assets.length;
  const statuses = OVERVIEW_STATUSES.map(status => ({ ...status, count: assets.filter(asset => asset.status === status.value).length }));
  const categories = [...DEPRECIATION_CATEGORIES.map(category => ({ id: String(category.id), label: category.label, count: assets.filter(asset => asset.categoryId === String(category.id)).length })),
    { id: "unclassified", label: "รอตรวจสอบประเภท", count: assets.filter(asset => asset.categoryId === "unclassified").length }];
  const byFacility = facilities.filter(facility => allowedSurveys.some(survey => survey.facilityId === facility.id))
    .map(facility => ({ ...facility, count: assets.filter(asset => asset.facilityId === facility.id).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  const sorted = [...assets].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || b.id - a.id);
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const page = Math.min(Number.isSafeInteger(filters.page) ? filters.page : 1, totalPages);
  return { total, facilities, byFacility, statuses, categories, latest: sorted.slice((page - 1) * 10, page * 10), totalPages, page, matchingFacilityCount: new Set(assets.map(asset => asset.facilityId)).size };
}
export type DashboardOverview = ReturnType<typeof buildDashboardOverview>;
