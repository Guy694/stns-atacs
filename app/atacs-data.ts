export type AssetRecord = {
  id: number;
  assetRegistrationNo: string;
  assetName: string;
  usageDescription: string;
  assetClass?: string;
  assetGroup: "Hardware" | "Software";
  deviceType: string;
  operatingSystem: string;
  windowsLicenseStatus?: "Genuine" | "Pirated" | null;
  privateIp: string;
  publicIp?: string;
  locationDetail: string;
  currentStatus: "Active" | "Inactive" | "Broken";
  ownerName: string;
  updatedBy: string;
  updatedAt: string;
  maintenanceEndDate: string;
  manufacturerBrand: string;
  serialNumber: string;
  purchasePrice?: number | null;
  purchaseDate?: string;
  purchaseOrderNo?: string;
};

export type FacilitySurvey = {
  facilityId: number;
  facilityName: string;
  districtName: string;
  facilityTypeCode?: string;
  surveyDate: string;
  personnelCount: number;
  completionRate: number;
  lastUpdatedBy: string;
  assets: AssetRecord[];
};

export type DistrictCoverage = {
  district: string;
  facilities: number;
  surveyed: number;
  completion: number;
};

export const facilitySurveys: FacilitySurvey[] = [];

export const districtCoverage: DistrictCoverage[] = [];
