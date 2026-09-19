import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";

import { parseAssetFields, type AssetFields, type ExistingAssetFields } from "@/lib/asset-input";
import { isItAsset, parseAssetClass } from "@/lib/asset-policy";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { createAsset, findOrCreateSurvey, updateAsset, type AssetInput } from "@/lib/assets";
import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { selectRows } from "@/lib/mysql";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";

type ImportRow = Record<string, unknown>;

type ExistingAssetRow = RowDataPacket & {
  id: number;
  facility_id: number;
  current_status: string | null;
  asset_class: string | null;
  work_group_id: number | null;
  survey_id: number;
};

type ImportError = {
  row: number;
  message: string;
};


function cell(row: ImportRow, key: string) {
  const value = row[key];
  return value === undefined || value === null ? "" : String(value).trim();
}

function optionalCell(row: ImportRow, key: string) {
  const value = cell(row, key);
  return value === "" ? undefined : value;
}

function parsePositiveId(value: string, fieldLabel: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} ต้องเป็นจำนวนเต็มบวก`);
  }
  return parsed;
}

function normalizeCategory(value: string | undefined, legacyGroup: string | undefined): "Hardware" | "Software" {
  const raw = (value || legacyGroup || "Hardware").trim().toLowerCase();
  if (["software", "system", "application", "app", "os"].includes(raw)) return "Software";
  if (["hardware", "network", "storage", "computer", "คอมพิวเตอร์"].includes(raw)) return "Hardware";
  throw new Error("asset_category ต้องเป็น Hardware หรือ Software");
}

const COLUMN_FIELDS = {
  asset_name: "assetName", asset_registration_no: "assetRegistrationNo", asset_class: "assetClass",
  asset_category: "assetCategory", asset_group: "assetGroup", device_type: "deviceType",
  usage_description: "usageDescription", owner_name: "ownerName", operating_system: "operatingSystem",
  operating_system_version: "operatingSystemVersion", windows_license_status: "windowsLicenseStatus",
  private_ip: "privateIp", public_ip: "publicIp", location_detail: "locationDetail", current_status: "currentStatus",
  manufacturer_brand: "manufacturerBrand", manufacturer_model: "manufacturerModel",
  manufacturer_specification: "manufacturerSpecification", serial_number: "serialNumber",
  purchase_price: "purchasePrice", purchase_date: "purchaseDate", purchase_order_no: "purchaseOrderNo",
  maintenance_start_date: "maintenanceStartDate", maintenance_end_date: "maintenanceEndDate", installed_at: "installedAt",
} as const;

function buildInput(row: ImportRow, surveyId: number, workGroupId: number | undefined, updatedBy: string, existingRow?: ExistingAssetRow): AssetInput {
  if (!cell(row, "asset_name")) throw new Error("กรุณาระบุ asset_name");
  const fields: AssetFields = {};
  const existing: Record<string, unknown> = {};
  for (const [column, field] of Object.entries(COLUMN_FIELDS)) {
    fields[field] = optionalCell(row, column);
    if (existingRow) {
      const value = existingRow[column];
      existing[field] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
    }
  }
  const assetClass = parseAssetClass(fields.assetClass, existingRow?.asset_class);
  if (isItAsset({ assetClass }) && (fields.assetCategory || fields.assetGroup)) {
    fields.assetCategory = normalizeCategory(fields.assetCategory, fields.assetGroup);
  }
  const parsed = parseAssetFields(fields, existingRow ? existing as ExistingAssetFields : undefined);
  return {
    ...parsed, surveyId: existingRow?.survey_id ?? surveyId, workGroupId: workGroupId ?? existingRow?.work_group_id ?? null,
    lastUpdatedAt: new Date().toISOString().slice(0, 10), updatedBy,
  };
}

async function validateUniqueValues(input: AssetInput, facilityId: number, assetId?: number) {
  if (input.assetRegistrationNo) {
    const duplicateRegistration = await selectRows<RowDataPacket & { id: number }>(
      `SELECT a.id
       FROM information_assets a
       WHERE a.asset_registration_no = ?
         AND (? IS NULL OR a.id <> ?)
       LIMIT 1`,
      [input.assetRegistrationNo, assetId ?? null, assetId ?? null]
    );
    if (duplicateRegistration.length > 0) throw new Error("เลขทะเบียนทรัพย์สินนี้มีในระบบแล้ว");
  }

  const serial = input.serialNumber?.trim();
  if (serial) {
    const duplicateSerial = await selectRows<RowDataPacket & { id: number }>(
      `SELECT a.id
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE s.facility_id = ?
         AND TRIM(a.serial_number) = ?
         AND (? IS NULL OR a.id <> ?)
       LIMIT 1`,
      [facilityId, serial, assetId ?? null, assetId ?? null]
    );
    if (duplicateSerial.length > 0) throw new Error("Serial Number นี้มีอยู่แล้วในหน่วยบริการนี้");
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({
      eventType: "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "พยายาม import ครุภัณฑ์โดยไม่มี session",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [canCreate, canUpdate] = await Promise.all([
    hasPermission(user.role, "assets.create"),
    hasPermission(user.role, "assets.update"),
  ]);
  if (!canMutateAssets(user) || (!canCreate && !canUpdate)) {
    await recordSecurityEvent({
      eventType: "api_forbidden",
      ipAddress: readRequestIp(req.headers),
      identity: user.fullName,
      path: req.nextUrl.pathname,
      detail: "พยายาม import ครุภัณฑ์โดยไม่มีสิทธิ์แก้ไข",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลอัปโหลดไม่ถูกต้อง" }, { status: 400 });
  }
  const file = formData.get("file");
  const facilityId = Number(formData.get("facilityId") ?? 0);
  if (!(file instanceof File) || !Number.isSafeInteger(facilityId) || facilityId <= 0) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์และหน่วยบริการ" }, { status: 400 });
  }
  if (!canManageAssetRecord(user, facilityId)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์นำเข้าข้อมูลสำหรับหน่วยบริการนี้" }, { status: 403 });
  }

  const filename = file.name.toLowerCase();
  if (!filename.endsWith(".csv") && !filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ CSV, XLSX หรือ XLS" }, { status: 400 });
  }

  let rows: ImportRow[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001, raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "", raw: false }).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.replace(/^\uFEFF/, "").trim(), value])
      )
    );
  } catch {
    return NextResponse.json({ error: "ไม่สามารถอ่านไฟล์ CSV หรือ Excel ได้" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });
  }
  if (!Object.keys(rows[0]).includes("asset_name")) {
    return NextResponse.json({ error: "ไม่พบคอลัมน์ asset_name กรุณาใช้ไฟล์ตัวอย่างของระบบ" }, { status: 400 });
  }

  const activeWorkGroups = await selectRows<RowDataPacket & { id: number }>(
    "SELECT id FROM facility_work_groups WHERE facility_id = ? AND is_active = 1",
    [facilityId]
  );
  const activeWorkGroupIds = new Set(activeWorkGroups.map((workGroup) => Number(workGroup.id)));
  const surveyId = await findOrCreateSurvey(facilityId);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      const assetId = parsePositiveId(cell(row, "id"), "id");
      let existingAsset: ExistingAssetRow | undefined;
      if (assetId) {
        if (!canUpdate) throw new Error("บัญชีนี้ไม่มีสิทธิ์แก้ไขทรัพย์สิน");
        const existing = await selectRows<ExistingAssetRow>(
          `SELECT a.*, s.facility_id
           FROM information_assets a
           JOIN information_asset_surveys s ON s.id = a.survey_id
           WHERE a.id = ?
           LIMIT 1`, [assetId]
        );
        existingAsset = existing[0];
        if (!existingAsset) throw new Error("ไม่พบครุภัณฑ์ตาม id ที่ระบุ");
        if (Number(existingAsset.facility_id) !== facilityId) throw new Error("id นี้ไม่ได้อยู่ในหน่วยบริการที่เลือก");
        if (!canManageAssetRecord(user, existingAsset.facility_id)) throw new Error("คุณไม่มีสิทธิ์แก้ไขครุภัณฑ์รายการนี้");
      } else if (!canCreate) throw new Error("บัญชีนี้ไม่มีสิทธิ์เพิ่มทรัพย์สิน");
      const workGroupId = parsePositiveId(cell(row, "work_group_id"), "work_group_id") ?? existingAsset?.work_group_id ?? undefined;
      if (activeWorkGroupIds.size > 0 && !workGroupId) throw new Error("หน่วยบริการนี้ต้องระบุ work_group_id");
      if (workGroupId && !activeWorkGroupIds.has(workGroupId)) throw new Error("work_group_id ไม่อยู่ในหน่วยบริการที่เลือกหรือถูกปิดใช้งาน");
      const input = buildInput(row, surveyId, workGroupId, user.fullName, existingAsset);
      if (assetId && existingAsset) {
        await validateUniqueValues(input, facilityId, assetId);
        await updateAsset(assetId, input);
        await recordAssetStatusHistory({
          assetId,
          fromStatus: existingAsset.current_status ?? "Active",
          toStatus: input.currentStatus ?? existingAsset.current_status ?? "Active",
          note: "นำเข้าข้อมูลจาก CSV",
          changedByUserId: user.id,
          changedBy: user.fullName,
        });
        await writeAuditLog({
          userId: user.id,
          userName: user.fullName,
          action: "update",
          entity: "information_assets",
          entityId: assetId,
          summary: `นำเข้า CSV เพื่อแก้ไขทรัพย์สิน ${input.assetName}${(existingAsset.asset_class || "IT") !== input.assetClass ? ` (เปลี่ยนกลุ่ม ${existingAsset.asset_class || "IT"} → ${input.assetClass})` : ""}`,
          skipDataAlert: true,
        });
        updated += 1;
      } else {
        if (!canCreate) throw new Error("บัญชีนี้ไม่มีสิทธิ์เพิ่มทรัพย์สิน");
        await validateUniqueValues(input, facilityId);
        const result = await createAsset(input);
        await recordAssetStatusHistory({
          assetId: result.insertId,
          fromStatus: null,
          toStatus: input.currentStatus ?? "Active",
          note: "นำเข้าข้อมูลจาก CSV",
          changedByUserId: user.id,
          changedBy: user.fullName,
        });
        await writeAuditLog({
          userId: user.id,
          userName: user.fullName,
          action: "create",
          entity: "information_assets",
          entityId: result.insertId,
          summary: `นำเข้า CSV เพื่อสร้างทรัพย์สิน ${input.assetName}`,
          skipDataAlert: true,
        });
        created += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
      });
    }
  }

  if (created + updated > 0) {
    revalidatePath("/assets");
    revalidatePath("/");
    revalidatePath(`/facilities/${facilityId}`);
  }

  await notifyTelegramSafe({
    category: "data",
    title: `สรุปการนำเข้าข้อมูล ${filename.endsWith(".csv") ? "CSV" : "Excel"}`,
    details: {
      ผู้ดำเนินการ: user.fullName,
      ไฟล์: file.name,
      รหัสหน่วยบริการ: facilityId,
      จำนวนทั้งหมด: `${rows.length} record`,
      นำเข้าสำเร็จ: `${created + updated} record`,
      เพิ่มใหม่: `${created} record`,
      แก้ไข: `${updated} record`,
      ข้ามหรือไม่สำเร็จ: `${skipped} record`,
    },
  });

  return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 30) });
}
