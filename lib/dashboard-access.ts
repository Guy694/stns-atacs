import "server-only";

import type { FacilitySurvey } from "@/app/atacs-data";

type Role = "admin" | "officer" | "viewer";

type DashboardUser = {
  role: Role;
  facilityId?: number | null;
};

export type DashboardFacilityGroup = "province" | "primary" | "primary-office" | "primary-unit" | "hospital";

export type DashboardFacilityContext = {
  id: number;
  name: string;
  typecode: string;
  districtName: string | null;
};

export type DashboardAccessScope = {
  surveys: FacilitySurvey[];
  scopeFacilityName: string | null;
  missingFacilityAssignment: boolean;
  officerScopeKind: "none" | "province" | "district-primary" | "own";
  lockedFacilityId: number | null;
};

export function inferDashboardFacilityGroup(
  facilityTypeCode?: string,
  facilityName?: string
): DashboardFacilityGroup | "other" {
  const text = `${facilityTypeCode ?? ""} ${facilityName ?? ""}`.replace(/\s+/g, "");

  if (text.includes("สสจ")) return "province";
  if (text.includes("สสอ")) return "primary-office";
  if (text.includes("รพ.สต") || text.includes("ศสช") || text.includes("สอน.")) return "primary-unit";
  if ((text.includes("รพ.") || text.includes("โรงพยาบาล")) && !text.includes("รพ.สต")) return "hospital";

  return "other";
}

export function matchesDashboardFacilityGroup(
  facilityTypeCode: string | undefined,
  facilityName: string | undefined,
  selectedGroup: DashboardFacilityGroup | ""
) {
  if (!selectedGroup) return true;
  const group = inferDashboardFacilityGroup(facilityTypeCode, facilityName);
  if (selectedGroup === "primary") return group === "primary-office" || group === "primary-unit";
  return group === selectedGroup;
}

export function buildDashboardAccessScope(
  user: DashboardUser,
  allFacilitySurveys: FacilitySurvey[],
  ownFacility: DashboardFacilityContext | null
): DashboardAccessScope {
  if (user.role !== "officer") {
    return {
      surveys: allFacilitySurveys,
      scopeFacilityName: null,
      missingFacilityAssignment: false,
      officerScopeKind: "none",
      lockedFacilityId: null,
    };
  }

  if (!user.facilityId) {
    return {
      surveys: [],
      scopeFacilityName: "รายการทรัพย์สิน",
      missingFacilityAssignment: true,
      officerScopeKind: "own",
      lockedFacilityId: null,
    };
  }

  const ownSurvey = allFacilitySurveys.find((survey) => survey.facilityId === Number(user.facilityId));
  const facilityName = ownFacility?.name ?? ownSurvey?.facilityName ?? "รายการทรัพย์สิน";
  const districtName = ownFacility?.districtName ?? ownSurvey?.districtName ?? null;
  const facilityTypeCode = ownFacility?.typecode ?? ownSurvey?.facilityTypeCode ?? "";
  const facilityGroup = inferDashboardFacilityGroup(facilityTypeCode, facilityName);

  if (facilityGroup === "province") {
    return {
      surveys: allFacilitySurveys,
      scopeFacilityName: facilityName,
      missingFacilityAssignment: false,
      officerScopeKind: "province",
      lockedFacilityId: null,
    };
  }

  if (facilityGroup === "primary-office" && districtName) {
    return {
      surveys: allFacilitySurveys.filter(
        (survey) =>
          survey.districtName === districtName &&
          ["primary-office", "primary-unit"].includes(inferDashboardFacilityGroup(survey.facilityTypeCode, survey.facilityName))
      ),
      scopeFacilityName: `สสอ ${districtName}`,
      missingFacilityAssignment: false,
      officerScopeKind: "district-primary",
      lockedFacilityId: null,
    };
  }

  return {
    surveys: allFacilitySurveys.filter((survey) => survey.facilityId === Number(user.facilityId)),
    scopeFacilityName: facilityName,
    missingFacilityAssignment: false,
    officerScopeKind: "own",
    lockedFacilityId: Number(user.facilityId),
  };
}
