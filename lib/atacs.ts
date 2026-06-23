import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import {
  districtCoverage as districtSeedCoverage,
  facilitySurveys as fallbackFacilitySurveys,
  type AssetRecord,
  type FacilitySurvey,
} from "@/app/atacs-data";
import { selectRows } from "@/lib/mysql";

type SurveyRow = RowDataPacket & {
  survey_id: number;
  facility_id: number;
  facility_name: string | null;
  facility_typecode: string | null;
  district_name: string | null;
  survey_date: Date | string | null;
  personnel_count: number | null;
  survey_updated_at: Date | string;
};

type AssetRow = RowDataPacket & {
  id: number;
  survey_id: number;
  asset_registration_no: string | null;
  asset_name: string;
  usage_description: string | null;
  owner_name: string | null;
  asset_category: "Hardware" | "Software" | null;
  asset_group: string | null;
  device_type: string | null;
  operating_system: string | null;
  private_ip: string | null;
  public_ip: string | null;
  location_detail: string | null;
  current_status: string | null;
  updated_by: string | null;
  audit_updated_at: Date | string;
  maintenance_end_date: Date | string | null;
  manufacturer_brand: string | null;
  serial_number: string | null;
};

export type DashboardData = {
  facilitySurveys: FacilitySurvey[];
  districtCoverage: Array<(typeof districtSeedCoverage)[number]>;
  dataSource: "database" | "fallback";
  connectionMessage: string;
  allowPublicOfficerBoard: boolean;
};

function toDateOnly(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function toDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 16).replace("T", " ");
  }

  return String(value).replace("T", " ").slice(0, 16);
}

function normalizeAssetGroup(value: string | null): AssetRecord["assetGroup"] {
  const normalized = (value ?? "Hardware").trim().toLowerCase();

  if (["software", "system", "application", "app", "os", "windows", "linux"].includes(normalized)) {
    return "Software";
  }

  if (["hardware", "network", "storage", "device", "equipment"].includes(normalized)) {
    return "Hardware";
  }

  return "Hardware";
}

function normalizeCurrentStatus(value: string | null): AssetRecord["currentStatus"] {
  const normalized = (value ?? "Active").trim().toLowerCase();

  if (["broken", "ชำรุด", "เสีย"].includes(normalized)) {
    return "Broken";
  }

  if (["inactive", "in-active", "not active", "ไม่ใช้งาน"].includes(normalized)) {
    return "Inactive";
  }

  return "Active";
}

function calculateCompletionRate(survey: Omit<FacilitySurvey, "completionRate">) {
  const headerFields = [survey.facilityName, survey.surveyDate !== "-" ? survey.surveyDate : "", String(survey.personnelCount || "")];
  const headerScore = headerFields.filter((field) => field.trim()).length / headerFields.length;

  if (survey.assets.length === 0) {
    return Math.round(headerScore * 100);
  }

  const assetScore =
    survey.assets.reduce((sum, asset) => {
      const fields = [
        asset.assetRegistrationNo,
        asset.assetName,
        asset.assetGroup,
        asset.deviceType,
        asset.locationDetail,
        asset.currentStatus,
        asset.ownerName,
        asset.updatedBy,
      ];

      return sum + fields.filter((field) => String(field ?? "").trim()).length / fields.length;
    }, 0) / survey.assets.length;

  return Math.round((headerScore * 0.35 + assetScore * 0.65) * 100);
}

function buildDistrictCoverage(facilitySurveys: FacilitySurvey[]) {
  const completionByDistrict = facilitySurveys.reduce<Record<string, { total: number; count: number }>>((summary, survey) => {
    const current = summary[survey.districtName] ?? { total: 0, count: 0 };
    summary[survey.districtName] = {
      total: current.total + survey.completionRate,
      count: current.count + 1,
    };
    return summary;
  }, {});

  return districtSeedCoverage.map((district) => {
    const current = completionByDistrict[district.district];

    if (!current) {
      return {
        ...district,
        completionRate: 0,
        facilities: 0,
      };
    }

    return {
      ...district,
      completionRate: Math.round(current.total / current.count),
      facilities: current.count,
    };
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const allowPublicOfficerBoard = process.env.ALLOW_PUBLIC_OFFICER_BOARD === "true";

  try {
    const surveys = await selectRows<SurveyRow>(
      `
        SELECT
          s.id AS survey_id,
          s.facility_id,
          hf.name AS facility_name,
          hf.typecode AS facility_typecode,
          hf.district_name,
          s.survey_date,
          s.personnel_count,
          s.updated_at AS survey_updated_at
        FROM information_asset_surveys s
        LEFT JOIN health_facilities hf ON hf.id = s.facility_id
        ORDER BY s.survey_date DESC, s.id DESC
      `
    );

    if (surveys.length === 0) {
      return {
        facilitySurveys: fallbackFacilitySurveys,
        districtCoverage: buildDistrictCoverage(fallbackFacilitySurveys),
        dataSource: "fallback",
        connectionMessage: "เชื่อมต่อ MySQL ได้แล้ว แต่ยังไม่มีข้อมูลใน information_asset_surveys จึงแสดงข้อมูลตัวอย่าง",
        allowPublicOfficerBoard,
      };
    }

    const surveyIds = surveys.map((survey) => survey.survey_id);
    const assets = await selectRows<AssetRow>(
      `
        SELECT
          id,
          survey_id,
          asset_registration_no,
          asset_name,
          usage_description,
          owner_name,
          asset_category,
          asset_group,
          device_type,
          operating_system,
          private_ip,
          public_ip,
          location_detail,
          current_status,
          updated_by,
          updated_at AS audit_updated_at,
          maintenance_end_date,
          manufacturer_brand,
          serial_number
        FROM information_assets
        WHERE survey_id IN (?)
        ORDER BY survey_id ASC, row_no ASC, id ASC
      `,
      [surveyIds]
    );

    const assetsBySurvey = assets.reduce<Record<number, AssetRecord[]>>((summary, asset) => {
      const current = summary[asset.survey_id] ?? [];
      current.push({
        id: asset.id,
        assetRegistrationNo: asset.asset_registration_no ?? "",
        assetName: asset.asset_name,
        usageDescription: asset.usage_description ?? "-",
        assetGroup: asset.asset_category ?? normalizeAssetGroup(asset.asset_group),
        deviceType: asset.device_type ?? "ไม่ระบุ",
        operatingSystem: asset.operating_system ?? "ไม่ระบุ",
        privateIp: asset.private_ip ?? "-",
        publicIp: asset.public_ip ?? "",
        locationDetail: asset.location_detail ?? "ไม่ระบุ",
        currentStatus: normalizeCurrentStatus(asset.current_status),
        ownerName: asset.owner_name ?? "ไม่ระบุ",
        updatedBy: asset.updated_by ?? "system",
        updatedAt: toDateTime(asset.audit_updated_at),
        maintenanceEndDate: toDateOnly(asset.maintenance_end_date),
        manufacturerBrand: asset.manufacturer_brand ?? "ไม่ระบุ",
        serialNumber: asset.serial_number ?? "ไม่ระบุ",
      });
      summary[asset.survey_id] = current;
      return summary;
    }, {});

    const facilitySurveys = surveys.map((survey) => {
      const surveyBase = {
        facilityId: survey.facility_id,
        facilityName: survey.facility_name ?? `Facility ${survey.facility_id}`,
        facilityTypeCode: survey.facility_typecode ?? "",
        districtName: survey.district_name ?? "ไม่ระบุอำเภอ",
        surveyDate: toDateOnly(survey.survey_date),
        personnelCount: survey.personnel_count ?? 0,
        lastUpdatedBy: (assetsBySurvey[survey.survey_id] ?? []).at(-1)?.updatedBy ?? "system",
        assets: assetsBySurvey[survey.survey_id] ?? [],
      };

      return {
        ...surveyBase,
        completionRate: calculateCompletionRate(surveyBase),
      };
    });

    return {
      facilitySurveys,
      districtCoverage: buildDistrictCoverage(facilitySurveys),
      dataSource: "database",
      connectionMessage: `สถานะฐานข้อมูล:เชื่อมต่อ (${facilitySurveys.length} สำรวจ, ${assets.length} ทรัพย์สิน)`,
      allowPublicOfficerBoard,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return {
      facilitySurveys: fallbackFacilitySurveys,
      districtCoverage: buildDistrictCoverage(fallbackFacilitySurveys),
      dataSource: "fallback",
      connectionMessage: `อ่านฐานข้อมูลไม่สำเร็จ: ${message} จึงแสดงข้อมูลตัวอย่างแทน`,
      allowPublicOfficerBoard,
    };
  }
}
