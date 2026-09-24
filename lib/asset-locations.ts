import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { selectRows } from "@/lib/mysql";

/**
 * รายชื่อ "ที่ตั้ง" ที่เคยบันทึกไว้แล้วในทะเบียน แยกตามหน่วยงาน
 * ใช้เป็นตัวเลือกใน dropdown ค้นหาได้ของแบบฟอร์มทรัพย์สิน
 * (ไม่ได้เก็บเป็นตารางแยก — ที่ตั้งจึงมาจากค่าที่เคยกรอกจริง เพิ่มค่าใหม่ได้โดยพิมพ์ลงไป)
 */
export type AssetLocationOption = { facilityId: number; location: string; usageCount: number };

type LocationRow = RowDataPacket & { facility_id: number; location: string; usage_count: number };

export async function listAssetLocations(facilityId?: number): Promise<AssetLocationOption[]> {
  try {
    const rows = await selectRows<LocationRow>(
      `SELECT s.facility_id AS facility_id,
              TRIM(a.location_detail) AS location,
              COUNT(*) AS usage_count
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE NULLIF(TRIM(a.location_detail), '') IS NOT NULL
         ${facilityId ? "AND s.facility_id = ?" : ""}
       GROUP BY s.facility_id, TRIM(a.location_detail)
       ORDER BY usage_count DESC, location ASC
       LIMIT 2000`,
      facilityId ? [facilityId] : []
    );
    return rows.map((row) => ({
      facilityId: Number(row.facility_id),
      location: row.location,
      usageCount: Number(row.usage_count),
    }));
  } catch {
    // ไม่ให้หน้าเสียเมื่อฐานข้อมูลยังไม่พร้อม — แบบฟอร์มยังพิมพ์ที่ตั้งเองได้
    return [];
  }
}
