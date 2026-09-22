import "server-only";

import type { FacilitySurvey } from "@/app/atacs-data";

type Role = "admin" | "officer" | "viewer";

type DashboardUser = {
  role: Role;
  facilityId?: number | null;
  managedAssetFacilityIds?: number[];
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
  const typeText = (facilityTypeCode ?? "").replace(/\s+/g, "");
  const nameText = (facilityName ?? "").replace(/\s+/g, "");
  const text = `${typeText}${nameText}`;

  if (text.includes("สสจ") || nameText.includes("สำนักงานสาธารณสุขจังหวัด")) return "province";
  if (text.includes("สสอ") || nameText.includes("สำนักงานสาธารณสุขอำเภอ")) return "primary-office";
  if (nameText.includes("โรงพยาบาลส่งเสริมสุขภาพตำบล") || typeText.includes("รพ.สต") || /^รพ\.สต(?:\.|$)/.test(nameText) || text.includes("ศสช") || text.includes("สอน.")) {
    return "primary-unit";
  }
  if (typeText.includes("รพ.ทั่วไป") || typeText.includes("รพ.ชุมชน") || nameText.startsWith("รพ.") || nameText.includes("โรงพยาบาล")) {
    return "hospital";
  }

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
  if (user.role === "admin") {
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
  const isDistrictOffice = inferDashboardFacilityGroup(
    ownFacility?.typecode ?? ownSurvey?.facilityTypeCode,
    ownFacility?.name ?? ownSurvey?.facilityName
  ) === "primary-office";
  if (user.role === "officer" && isDistrictOffice) {
    const managedFacilityIds = new Set(user.managedAssetFacilityIds ?? []);
    return {
      surveys: allFacilitySurveys.filter((survey) => survey.facilityId === Number(user.facilityId) || (
        managedFacilityIds.has(survey.facilityId) &&
        inferDashboardFacilityGroup(survey.facilityTypeCode, survey.facilityName) === "primary-unit"
      )),
      scopeFacilityName: ownFacility?.name ?? ownSurvey?.facilityName ?? "สสอ. และ รพ.สต. ในความดูแล",
      missingFacilityAssignment: false,
      officerScopeKind: "district-primary",
      lockedFacilityId: null,
    };
  }

  const facilityName = ownFacility?.name ?? ownSurvey?.facilityName ?? "รายการทรัพย์สิน";
  return {
    surveys: allFacilitySurveys.filter((survey) => survey.facilityId === Number(user.facilityId)),
    scopeFacilityName: facilityName,
    missingFacilityAssignment: false,
    officerScopeKind: "own",
    lockedFacilityId: Number(user.facilityId),
  };
}
