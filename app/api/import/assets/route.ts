import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";

import { ASSET_CLASS_VALUE_SET, normalizeAssetClass } from "@/lib/asset-classes";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { createAsset, findOrCreateSurvey, updateAsset, type AssetInput } from "@/lib/assets";
import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { selectRows } from "@/lib/mysql";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { isComputerDeviceType, WINDOWS_LICENSE_STATUS_VALUES, type WindowsLicenseStatus } from "@/lib/windows-license";

type ImportRow = Record<string, unknown>;

type ExistingAssetRow = RowDataPacket & {
  id: number;
  facility_id: number;
  current_status: string | null;
};

type ImportError = {
  row: number;
  message: string;
};

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

function isValidDateOnly(value: string | undefined) {
  if (!value) return true;
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeCategory(value: string | undefined, legacyGroup: string | undefined): "Hardware" | "Software" {
  const raw = (value || legacyGroup || "Hardware").trim().toLowerCase();
  if (["software", "system", "application", "app", "os"].includes(raw)) return "Software";
  if (["hardware", "network", "storage", "computer", "คอมพิวเตอร์"].includes(raw)) return "Hardware";
  throw new Error("asset_category ต้องเป็น Hardware หรือ Software");
}

function buildInput(row: ImportRow, surveyId: number, workGroupId: number | undefined, updatedBy: string): AssetInput {
  const assetName = cell(row, "asset_name");
  if (!assetName) throw new Error("กรุณาระบุ asset_name");

  const assetClassInput = optionalCell(row, "asset_class") ?? "IT";
  if (!ASSET_CLASS_VALUE_SET.has(assetClassInput)) {
    throw new Error("asset_class ไม่ถูกต้อง");
  }

  const assetCategory = normalizeCategory(optionalCell(row, "asset_category"), optionalCell(row, "asset_group"));
  const deviceType = optionalCell(row, "device_type");
  const windowsLicenseStatusInput = optionalCell(row, "windows_license_status");
  const requiresWindowsLicenseStatus = assetCategory === "Hardware" && isComputerDeviceType(deviceType);

  if (requiresWindowsLicenseStatus && !windowsLicenseStatusInput) {
    throw new Error("ครุภัณฑ์คอมพิวเตอร์ต้องระบุ windows_license_status เป็น Genuine หรือ Pirated");
  }
  if (windowsLicenseStatusInput && !WINDOWS_LICENSE_STATUS_VALUES.includes(windowsLicenseStatusInput as WindowsLicenseStatus)) {
    throw new Error("windows_license_status ต้องเป็น Genuine หรือ Pirated");
  }

  const publicIp = optionalCell(row, "public_ip");
  if (publicIp && !IPV4_REGEX.test(publicIp)) {
    throw new Error("public_ip ไม่ถูกต้อง");
  }

  const purchasePriceText = optionalCell(row, "purchase_price");
  const purchasePrice = purchasePriceText === undefined ? undefined : Number(purchasePriceText.replace(/,/g, ""));
  if (purchasePrice !== undefined && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
    throw new Error("purchase_price ต้องเป็นตัวเลขที่ไม่ติดลบ");
  }

  const purchaseDate = optionalCell(row, "purchase_date");
  const maintenanceStartDate = optionalCell(row, "maintenance_start_date");
  const maintenanceEndDate = optionalCell(row, "maintenance_end_date");
  const installedAt = optionalCell(row, "installed_at");
  for (const [label, value] of Object.entries({ purchase_date: purchaseDate, maintenance_start_date: maintenanceStartDate, maintenance_end_date: maintenanceEndDate, installed_at: installedAt })) {
    if (!isValidDateOnly(value)) throw new Error(`${label} ต้องอยู่ในรูปแบบ YYYY-MM-DD`);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (purchaseDate && purchaseDate > today) throw new Error("purchase_date ต้องไม่เกินวันที่ปัจจุบัน");
  if (maintenanceStartDate && maintenanceEndDate && maintenanceEndDate < maintenanceStartDate) {
    throw new Error("maintenance_end_date ต้องไม่ก่อน maintenance_start_date");
  }

  return {
    surveyId,
    workGroupId: workGroupId ?? null,
    assetRegistrationNo: optionalCell(row, "asset_registration_no") ?? null,
    assetName,
    assetClass: normalizeAssetClass(assetClassInput),
    assetCategory,
    assetGroup: optionalCell(row, "asset_group"),
    deviceType,
    usageDescription: optionalCell(row, "usage_description"),
    ownerName: optionalCell(row, "owner_name"),
    operatingSystem: optionalCell(row, "operating_system"),
    operatingSystemVersion: optionalCell(row, "operating_system_version"),
    windowsLicenseStatus: requiresWindowsLicenseStatus ? (windowsLicenseStatusInput as WindowsLicenseStatus) : null,
    privateIp: optionalCell(row, "private_ip"),
    publicIp,
    locationDetail: optionalCell(row, "location_detail"),
    currentStatus: optionalCell(row, "current_status") ?? "Active",
    manufacturerBrand: optionalCell(row, "manufacturer_brand"),
    manufacturerModel: optionalCell(row, "manufacturer_model"),
    manufacturerSpecification: optionalCell(row, "manufacturer_specification"),
    serialNumber: optionalCell(row, "serial_number"),
    purchasePrice,
    purchaseDate,
    purchaseOrderNo: optionalCell(row, "purchase_order_no"),
    maintenanceStartDate,
    maintenanceEndDate,
    installedAt,
    lastUpdatedAt: today,
    updatedBy,
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
      const workGroupId = parsePositiveId(cell(row, "work_group_id"), "work_group_id");
      if (activeWorkGroupIds.size > 0 && !workGroupId) {
        throw new Error("หน่วยบริการนี้ต้องระบุ work_group_id");
      }
      if (workGroupId && !activeWorkGroupIds.has(workGroupId)) {
        throw new Error("work_group_id ไม่อยู่ในหน่วยบริการที่เลือกหรือถูกปิดใช้งาน");
      }

      const input = buildInput(row, surveyId, workGroupId, user.fullName);
      if (assetId) {
        if (!canUpdate) throw new Error("บัญชีนี้ไม่มีสิทธิ์แก้ไขทรัพย์สิน");
        const existing = await selectRows<ExistingAssetRow>(
          `SELECT a.id, s.facility_id, a.current_status
           FROM information_assets a
           JOIN information_asset_surveys s ON s.id = a.survey_id
           WHERE a.id = ?
           LIMIT 1`,
          [assetId]
        );
        if (!existing[0]) throw new Error("ไม่พบครุภัณฑ์ตาม id ที่ระบุ");
        if (Number(existing[0].facility_id) !== facilityId) throw new Error("id นี้ไม่ได้อยู่ในหน่วยบริการที่เลือก");
        if (!canManageAssetRecord(user, existing[0].facility_id)) throw new Error("คุณไม่มีสิทธิ์แก้ไขครุภัณฑ์รายการนี้");

        await validateUniqueValues(input, facilityId, assetId);
        await updateAsset(assetId, input);
        await recordAssetStatusHistory({
          assetId,
          fromStatus: existing[0].current_status ?? "Active",
          toStatus: input.currentStatus ?? "Active",
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
          summary: `นำเข้า CSV เพื่อแก้ไขทรัพย์สิน ${input.assetName}`,
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

  return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 30) });
}
