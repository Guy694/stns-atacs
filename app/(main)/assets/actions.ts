"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { getCurrentUser } from "@/lib/auth";
import { createAsset, deleteAsset, findOrCreateSurvey, getAssetById, updateAsset, type AssetInput } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { selectRows } from "@/lib/mysql";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

function readStr(fd: FormData, key: string) {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

function readOptional(fd: FormData, key: string) {
  const v = readStr(fd, key);
  return v === "" ? undefined : v;
}

type AssetFormInput = AssetInput & { facilityId: number };

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function parseDateOnly(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function validateAssetBusinessRules(input: AssetFormInput, assetId?: number) {
  if (input.privateIp && !IPV4_REGEX.test(input.privateIp)) {
    throw new Error("Private IP ไม่ถูกต้อง");
  }

  if (input.publicIp && !IPV4_REGEX.test(input.publicIp)) {
    throw new Error("Public IP ไม่ถูกต้อง");
  }

  if (input.purchasePrice !== undefined && input.purchasePrice !== null) {
    if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
      throw new Error("ราคาที่ซื้อต้องเป็นตัวเลขและต้องไม่ติดลบ");
    }
  }

  const today = parseDateOnly(new Date().toISOString().slice(0, 10));
  const purchaseDate = parseDateOnly(input.purchaseDate);
  if (purchaseDate && today && purchaseDate.getTime() > today.getTime()) {
    throw new Error("วันที่ซื้อห้ามเกินวันที่ปัจจุบัน");
  }

  const maintenanceStart = parseDateOnly(input.maintenanceStartDate);
  const maintenanceEnd = parseDateOnly(input.maintenanceEndDate);
  if (maintenanceStart && maintenanceEnd && maintenanceEnd.getTime() < maintenanceStart.getTime()) {
    throw new Error("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา");
  }

  const duplicateRows = await selectRows<RowDataPacket & { id: number }>(
    `SELECT id
     FROM information_assets
     WHERE asset_registration_no = ?
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [input.assetRegistrationNo, assetId ?? null, assetId ?? null]
  );
  if (duplicateRows.length > 0) {
    throw new Error("เลขทะเบียนทรัพย์สินนี้มีในระบบแล้ว");
  }

  const serial = input.serialNumber?.trim();
  if (serial) {
    const duplicateSerialRows = await selectRows<RowDataPacket & { id: number }>(
      `SELECT a.id
       FROM information_assets a
       JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE s.facility_id = ?
         AND TRIM(a.serial_number) = ?
         AND (? IS NULL OR a.id <> ?)
       LIMIT 1`,
      [input.facilityId, serial, assetId ?? null, assetId ?? null]
    );

    if (duplicateSerialRows.length > 0) {
      throw new Error("Serial Number นี้มีอยู่แล้วในหน่วยงานนี้");
    }
  }
}

async function buildInput(fd: FormData, updaterName: string): Promise<AssetFormInput> {
  const facilityId = Number(fd.get("facilityId"));
  if (!facilityId || isNaN(facilityId)) throw new Error("กรุณาเลือกหน่วยงาน");
  const surveyId = await findOrCreateSurvey(facilityId);

  const assetRegistrationNo = readStr(fd, "assetRegistrationNo");
  if (!assetRegistrationNo) throw new Error("กรุณากรอกเลขทะเบียนทรัพย์สิน");

  const assetName = readStr(fd, "assetName");
  if (!assetName) throw new Error("กรุณากรอกชื่อทรัพย์สิน");

  const assetCategory = readStr(fd, "assetCategory") as "Hardware" | "Software";
  if (!["Hardware", "Software"].includes(assetCategory)) throw new Error("หมวดทรัพย์สินไม่ถูกต้อง");

  return {
    surveyId,
    assetRegistrationNo,
    assetName,
    assetCategory,
    usageDescription: readOptional(fd, "usageDescription"),
    ownerName: readOptional(fd, "ownerName"),
    deviceType: readOptional(fd, "deviceType"),
    operatingSystem: readOptional(fd, "operatingSystem"),
    operatingSystemVersion: readOptional(fd, "operatingSystemVersion"),
    privateIp: readOptional(fd, "privateIp"),
    publicIp: readOptional(fd, "publicIp"),
    locationDetail: readOptional(fd, "locationDetail"),
    currentStatus: readOptional(fd, "currentStatus") ?? "Active",
    updatedBy: updaterName,
    manufacturerBrand: readOptional(fd, "manufacturerBrand"),
    manufacturerModel: readOptional(fd, "manufacturerModel"),
    serialNumber: readOptional(fd, "serialNumber"),
    purchasePrice: (() => { const v = readOptional(fd, "purchasePrice"); return v ? Number(v) : undefined; })(),
    purchaseDate: readOptional(fd, "purchaseDate"),
    purchaseOrderNo: readOptional(fd, "purchaseOrderNo"),
    maintenanceStartDate: readOptional(fd, "maintenanceStartDate"),
    maintenanceEndDate: readOptional(fd, "maintenanceEndDate"),
    installedAt: readOptional(fd, "installedAt"),
    lastUpdatedAt: new Date().toISOString().slice(0, 10),
    facilityId,
  };
}

function canManageFacility(user: Awaited<ReturnType<typeof getCurrentUser>>, facilityId: number) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "officer" && user.facilityId === facilityId;
}

export async function createAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (user.role === "viewer") return "คุณไม่มีสิทธิ์ดำเนินการนี้";

  try {
    const input = await buildInput(fd, user.fullName);
    await validateAssetBusinessRules(input);
    if (!canManageFacility(user, input.facilityId)) return "คุณไม่มีสิทธิ์ดำเนินการกับหน่วยงานนี้";
    const result = await createAsset(input);
    const newId = result.insertId;
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "create", entity: "information_assets", entityId: newId, summary: `สร้างทรัพย์สิน ${input.assetName} (${input.assetRegistrationNo})` });
    revalidatePath("/assets");
    revalidatePath("/");
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function updateAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (user.role === "viewer") return "คุณไม่มีสิทธิ์ดำเนินการนี้";

  const id = Number(fd.get("assetId"));
  if (!id || isNaN(id)) return "ID ทรัพย์สินไม่ถูกต้อง";

  try {
    const input = await buildInput(fd, user.fullName);
    await validateAssetBusinessRules(input, id);
    if (!canManageFacility(user, input.facilityId)) return "คุณไม่มีสิทธิ์ดำเนินการกับหน่วยงานนี้";
    await updateAsset(id, input);
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "information_assets", entityId: id, summary: `แก้ไขทรัพย์สิน ${input.assetName}` });
    revalidatePath("/assets");
    revalidatePath("/");
    revalidatePath(`/facilities/${input.facilityId}`);
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function deleteAssetAction(id: number): Promise<string | null> {
  const user = await requireAuth();
  if (user.role === "viewer") return "คุณไม่มีสิทธิ์ดำเนินการนี้";

  try {
    const asset = await getAssetById(id);
    if (!asset) return "ไม่พบทรัพย์สิน";
    if (!canManageFacility(user, asset.facilityId)) return "คุณไม่มีสิทธิ์ลบทรัพย์สินของหน่วยงานนี้";
    await deleteAsset(id);
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "delete", entity: "information_assets", entityId: id, summary: `ลบทรัพย์สิน #${id}` });
    revalidatePath("/assets");
    revalidatePath(`/facilities/${asset.facilityId}`);
    revalidatePath("/");
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}
