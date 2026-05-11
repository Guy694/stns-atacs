import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { facilitySurveys as fallbackFacilitySurveys } from "@/app/atacs-data";
import { selectRows } from "@/lib/mysql";

type PublicMetricsRow = RowDataPacket & {
  total_facilities: number | null;
  total_assets: number | null;
  total_districts: number | null;
  active_assets: number | null;
  degraded_assets: number | null;
  hardware_assets: number | null;
  software_assets: number | null;
};

type PublicDistrictRow = RowDataPacket & {
  district_name: string | null;
  facilities: number;
  assets: number;
  completion_rate: number;
};

type PublicDeviceTypeRow = RowDataPacket & {
  device_type: string | null;
  count: number;
};

export type PublicDashboardData = {
  totalFacilities: number;
  totalAssets: number;
  totalDistricts: number;
  activeAssets: number;
  degradedAssets: number;
  hardwareAssets: number;
  softwareAssets: number;
  districtSummary: Array<{
    districtName: string;
    facilities: number;
    assets: number;
    completionRate: number;
  }>;
  deviceTypeSummary: Array<{
    deviceType: string;
    count: number;
  }>;
  dataSource: "database" | "fallback";
  connectionMessage: string;
};

function buildFallbackPublicData(): PublicDashboardData {
  const allAssets = fallbackFacilitySurveys.flatMap((survey) =>
    survey.assets.map((asset) => ({ ...asset, districtName: survey.districtName }))
  );

  const districtSummary = Object.entries(
    fallbackFacilitySurveys.reduce<Record<string, { facilities: number; assets: number; completion: number }>>(
      (summary, survey) => {
        const current = summary[survey.districtName] ?? { facilities: 0, assets: 0, completion: 0 };
        summary[survey.districtName] = {
          facilities: current.facilities + 1,
          assets: current.assets + survey.assets.length,
          completion: current.completion + survey.completionRate,
        };
        return summary;
      },
      {}
    )
  )
    .map(([districtName, summary]) => ({
      districtName,
      facilities: summary.facilities,
      assets: summary.assets,
      completionRate: Math.round(summary.completion / summary.facilities),
    }))
    .sort((left, right) => right.assets - left.assets);

  const deviceTypeSummary = Object.entries(
    allAssets.reduce<Record<string, number>>((summary, asset) => {
      summary[asset.deviceType] = (summary[asset.deviceType] ?? 0) + 1;
      return summary;
    }, {})
  )
    .map(([deviceType, count]) => ({ deviceType, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  return {
    totalFacilities: fallbackFacilitySurveys.length,
    totalAssets: allAssets.length,
    totalDistricts: new Set(fallbackFacilitySurveys.map((survey) => survey.districtName)).size,
    activeAssets: allAssets.filter((asset) => asset.currentStatus === "Active").length,
    degradedAssets: allAssets.filter((asset) => asset.currentStatus !== "Active").length,
    hardwareAssets: allAssets.filter((asset) => asset.assetGroup === "Hardware").length,
    softwareAssets: allAssets.filter((asset) => asset.assetGroup === "Software").length,
    districtSummary,
    deviceTypeSummary,
    dataSource: "fallback",
    connectionMessage: "เชื่อมต่อ MySQL ได้แล้ว แต่ยังไม่มีข้อมูลสรุปสำหรับ public dashboard จึงแสดงข้อมูลตัวอย่าง",
  };
}

export async function getPublicDashboardData(): Promise<PublicDashboardData> {
  try {
    const metricsRows = await selectRows<PublicMetricsRow>(
      `
        SELECT
          COUNT(DISTINCT s.facility_id) AS total_facilities,
          COUNT(a.id) AS total_assets,
          COUNT(DISTINCT hf.district_name) AS total_districts,
          SUM(CASE WHEN LOWER(COALESCE(a.current_status, '')) NOT IN ('inactive', 'in-active', 'not active', 'ไม่ใช้งาน', 'broken', 'ชำรุด', 'เสีย') THEN 1 ELSE 0 END) AS active_assets,
          SUM(CASE WHEN LOWER(COALESCE(a.current_status, '')) IN ('inactive', 'in-active', 'not active', 'ไม่ใช้งาน', 'broken', 'ชำรุด', 'เสีย') THEN 1 ELSE 0 END) AS degraded_assets,
          SUM(CASE WHEN a.asset_category = 'Hardware' THEN 1 ELSE 0 END) AS hardware_assets,
          SUM(CASE WHEN a.asset_category = 'Software' THEN 1 ELSE 0 END) AS software_assets
        FROM information_asset_surveys s
        LEFT JOIN health_facilities hf ON hf.id = s.facility_id
        LEFT JOIN information_assets a ON a.survey_id = s.id
      `
    );

    const metrics = metricsRows[0];
    if (!metrics || Number(metrics.total_facilities ?? 0) === 0) {
      return buildFallbackPublicData();
    }

    const districtRows = await selectRows<PublicDistrictRow>(
      `
        SELECT
          COALESCE(hf.district_name, 'ไม่ระบุอำเภอ') AS district_name,
          COUNT(DISTINCT s.facility_id) AS facilities,
          COUNT(a.id) AS assets,
          ROUND(AVG(
            CASE
              WHEN s.personnel_count IS NULL OR s.personnel_count = 0 THEN 70
              ELSE 100
            END
          )) AS completion_rate
        FROM information_asset_surveys s
        LEFT JOIN health_facilities hf ON hf.id = s.facility_id
        LEFT JOIN information_assets a ON a.survey_id = s.id
        GROUP BY COALESCE(hf.district_name, 'ไม่ระบุอำเภอ')
        ORDER BY assets DESC, district_name ASC
      `
    );

    const deviceTypeRows = await selectRows<PublicDeviceTypeRow>(
      `
        SELECT
          COALESCE(NULLIF(a.device_type, ''), 'ไม่ระบุ') AS device_type,
          COUNT(*) AS count
        FROM information_assets a
        INNER JOIN information_asset_surveys s ON s.id = a.survey_id
        GROUP BY COALESCE(NULLIF(a.device_type, ''), 'ไม่ระบุ')
        ORDER BY count DESC, device_type ASC
        LIMIT 6
      `
    );

    return {
      totalFacilities: Number(metrics.total_facilities ?? 0),
      totalAssets: Number(metrics.total_assets ?? 0),
      totalDistricts: Number(metrics.total_districts ?? 0),
      activeAssets: Number(metrics.active_assets ?? 0),
      degradedAssets: Number(metrics.degraded_assets ?? 0),
      hardwareAssets: Number(metrics.hardware_assets ?? 0),
      softwareAssets: Number(metrics.software_assets ?? 0),
      districtSummary: districtRows.map((row) => ({
        districtName: row.district_name ?? "ไม่ระบุอำเภอ",
        facilities: Number(row.facilities ?? 0),
        assets: Number(row.assets ?? 0),
        completionRate: Number(row.completion_rate ?? 0),
      })),
      deviceTypeSummary: deviceTypeRows.map((row) => ({
        deviceType: row.device_type ?? "ไม่ระบุ",
        count: Number(row.count ?? 0),
      })),
      dataSource: "database",
      connectionMessage: `โหลดข้อมูลสรุป public จาก MySQL ฐาน ${process.env.MYSQL_DATABASE}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    const fallback = buildFallbackPublicData();

    return {
      ...fallback,
      connectionMessage: `อ่านข้อมูล public จากฐานไม่สำเร็จ: ${message} จึงแสดงข้อมูลตัวอย่างแทน`,
    };
  }
}