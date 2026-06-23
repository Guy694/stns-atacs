import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getCurrentUser } from "@/lib/auth";
import { executeStatement, selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

type AssetImportRow = {
  asset_registration_no: string;
  asset_name: string;
  asset_category: string;
  asset_group: string;
  device_type: string;
  manufacturer_brand: string;
  serial_number: string;
  operating_system: string;
  private_ip: string;
  public_ip: string;
  owner_name: string;
  location_detail: string;
  current_status: string;
  maintenance_end_date: string;
  usage_description: string;
};

type SurveyRow = RowDataPacket & { id: number; facility_id: number; facility_name: string | null };

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    await recordSecurityEvent({
      eventType: user ? "api_forbidden" : "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      identity: user?.fullName,
      path: req.nextUrl.pathname,
      detail: "พยายาม import ทรัพย์สินโดยไม่มีสิทธิ์ admin",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const facilityId = Number(formData.get("facilityId") ?? 0);

  if (!file || !facilityId) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์และหน่วยบริการ" }, { status: 400 });
  }

  // Read xlsx
  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", codepage: 874 });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถอ่านไฟล์ Excel ได้" }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<AssetImportRow>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });
  }

  // Get or create survey for this facility
  const surveys = await selectRows<SurveyRow>(
    "SELECT id, facility_id, facility_name FROM information_asset_surveys WHERE facility_id = ? LIMIT 1",
    [facilityId]
  );
  let surveyId: number;
  if (surveys[0]) {
    surveyId = surveys[0].id;
  } else {
    const result = await executeStatement(
      "INSERT INTO information_asset_surveys (facility_id, survey_title, survey_date) VALUES (?, 'Import', NOW())",
      [facilityId]
    );
    surveyId = result.insertId;
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const regNo = String(row.asset_registration_no ?? "").trim();
    if (!regNo || !row.asset_name) { skipped++; continue; }

    try {
      await executeStatement(
        `INSERT INTO information_assets
          (survey_id, asset_registration_no, asset_name, asset_category, asset_group, device_type,
           manufacturer_brand, serial_number, operating_system, private_ip, public_ip,
           owner_name, location_detail, current_status, maintenance_end_date, usage_description,
           updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           asset_name = VALUES(asset_name),
           updated_by = VALUES(updated_by)`,
        [
          surveyId,
          regNo,
          String(row.asset_name ?? "").trim(),
          String(row.asset_category ?? "Hardware").trim() || "Hardware",
          String(row.asset_group ?? "").trim() || null,
          String(row.device_type ?? "").trim() || null,
          String(row.manufacturer_brand ?? "").trim() || null,
          String(row.serial_number ?? "").trim() || null,
          String(row.operating_system ?? "").trim() || null,
          String(row.private_ip ?? "").trim() || null,
          String(row.public_ip ?? "").trim() || null,
          String(row.owner_name ?? "").trim() || null,
          String(row.location_detail ?? "").trim() || null,
          String(row.current_status ?? "Active").trim() || "Active",
          String(row.maintenance_end_date ?? "").trim() || null,
          String(row.usage_description ?? "").trim() || null,
          user.fullName,
        ]
      );
      inserted++;
    } catch (e) {
      errors.push(`แถว ${regNo}: ${(e as Error).message}`);
      skipped++;
    }
  }

  return NextResponse.json({ inserted, skipped, errors: errors.slice(0, 10) });
}
