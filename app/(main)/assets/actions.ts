"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { ASSET_CLASS_VALUE_SET, normalizeAssetClass } from "@/lib/asset-classes";
import { getCurrentUser } from "@/lib/auth";
import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { createAsset, deleteAsset, findOrCreateSurvey, getAssetById, updateAsset, type AssetInput, type AssetWithFacility } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { selectRows } from "@/lib/mysql";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

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
const MAX_ASSET_IMAGE_BYTES = 5 * 1024 * 1024;
const ASSET_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseDateOnly(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readFile(fd: FormData, key: string) {
  const file = fd.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

async function storeAssetImage(file: File, slot: 1 | 2) {
  const extension = ASSET_IMAGE_TYPES[file.type];
  if (!extension) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP");
  }
  if (file.size > MAX_ASSET_IMAGE_BYTES) {
    throw new Error("รูปภาพต้องมีขนาดไม่เกิน 5MB ต่อภาพ");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "assets");
  await mkdir(uploadDir, { recursive: true });

  const filename = `asset-${Date.now()}-${slot}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), bytes);

  return `/uploads/assets/${filename}`;
}

async function buildAssetImageUrls(fd: FormData, currentAsset?: AssetWithFacility | null) {
  const firstFile = readFile(fd, "assetImage1");
  const secondFile = readFile(fd, "assetImage2");
  const removeFirst = readStr(fd, "removeAssetImage1") === "1";
  const removeSecond = readStr(fd, "removeAssetImage2") === "1";

  return {
    assetImage1Url: firstFile
      ? await storeAssetImage(firstFile, 1)
      : removeFirst
        ? null
        : currentAsset?.assetImage1Url || null,
    assetImage2Url: secondFile
      ? await storeAssetImage(secondFile, 2)
      : removeSecond
        ? null
        : currentAsset?.assetImage2Url || null,
  };
}

async function validateAssetBusinessRules(input: AssetFormInput, assetId?: number) {
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

  if (input.assetRegistrationNo) {
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
  }

  const activeWorkGroups = await selectRows<RowDataPacket & { id: number }>(
    "SELECT id FROM facility_work_groups WHERE facility_id = ? AND is_active = 1",
    [input.facilityId]
  );
  if (activeWorkGroups.length > 0 && !input.workGroupId) {
    throw new Error("กรุณาเลือกกลุ่มงานของทรัพย์สิน");
  }
  if (input.workGroupId && !activeWorkGroups.some((workGroup) => Number(workGroup.id) === Number(input.workGroupId))) {
    throw new Error("กลุ่มงานไม่อยู่ในหน่วยงานที่เลือก");
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

  const assetRegistrationNo = readOptional(fd, "assetRegistrationNo") ?? null;

  const assetName = readStr(fd, "assetName");
  if (!assetName) throw new Error("กรุณากรอกชื่อทรัพย์สิน");

  const assetClassInput = readOptional(fd, "assetClass") ?? "IT";
  if (!ASSET_CLASS_VALUE_SET.has(assetClassInput)) throw new Error("กลุ่มครุภัณฑ์ไม่ถูกต้อง");
  const assetClass = normalizeAssetClass(assetClassInput);

  const assetCategory = readStr(fd, "assetCategory") as "Hardware" | "Software";
  if (!["Hardware", "Software"].includes(assetCategory)) throw new Error("ลักษณะทรัพย์สินไม่ถูกต้อง");
  const workGroupIdRaw = readOptional(fd, "workGroupId");
  let parsedWorkGroupId: number | null = null;
  if (workGroupIdRaw) {
    const value = Number(workGroupIdRaw);
    if (!Number.isInteger(value) || value <= 0) throw new Error("กลุ่มงานไม่ถูกต้อง");
    parsedWorkGroupId = value;
  }

  return {
    surveyId,
    workGroupId: parsedWorkGroupId,
    assetRegistrationNo,
    assetName,
    assetClass,
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

export async function createAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "assets.create"))) return "สิทธิ์การเพิ่มทรัพย์สินถูกปิดใช้งาน";

  try {
    const requestedFacilityId = Number(fd.get("facilityId"));
    if (!requestedFacilityId || isNaN(requestedFacilityId)) return "กรุณาเลือกหน่วยงาน";
    if (!canManageAssetRecord(user, requestedFacilityId)) return "คุณไม่มีสิทธิ์ดำเนินการกับหน่วยงานนี้";
    const input = await buildInput(fd, user.fullName);
    await validateAssetBusinessRules(input);
    const imageUrls = await buildAssetImageUrls(fd);
    const result = await createAsset({ ...input, ...imageUrls });
    const newId = result.insertId;
    await recordAssetStatusHistory({
      assetId: newId,
      fromStatus: null,
      toStatus: input.currentStatus ?? "Active",
      note: "สร้างทะเบียนทรัพย์สิน",
      changedByUserId: user.id,
      changedBy: user.fullName,
    });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "create", entity: "information_assets", entityId: newId, summary: input.assetRegistrationNo ? `สร้างทรัพย์สิน ${input.assetName} (${input.assetRegistrationNo})` : `สร้างทรัพย์สิน ${input.assetName}` });
    revalidatePath("/assets");
    revalidatePath("/");
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function updateAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "assets.update"))) return "สิทธิ์การแก้ไขทรัพย์สินถูกปิดใช้งาน";

  const id = Number(fd.get("assetId"));
  if (!id || isNaN(id)) return "ID ทรัพย์สินไม่ถูกต้อง";

  try {
    const currentAsset = await getAssetById(id);
    if (!currentAsset) return "ไม่พบทรัพย์สิน";
    if (!canManageAssetRecord(user, currentAsset.facilityId)) return "คุณไม่มีสิทธิ์ดำเนินการกับทรัพย์สินนี้";
    const requestedFacilityId = Number(fd.get("facilityId"));
    if (!requestedFacilityId || isNaN(requestedFacilityId)) return "กรุณาเลือกหน่วยงาน";
    if (!canManageAssetRecord(user, requestedFacilityId)) return "คุณไม่มีสิทธิ์ดำเนินการกับหน่วยงานนี้";
    const input = await buildInput(fd, user.fullName);
    await validateAssetBusinessRules(input, id);
    const imageUrls = await buildAssetImageUrls(fd, currentAsset);
    await updateAsset(id, { ...input, ...imageUrls });
    await recordAssetStatusHistory({
      assetId: id,
      fromStatus: currentAsset.currentStatus,
      toStatus: input.currentStatus ?? currentAsset.currentStatus,
      note: "แก้ไขข้อมูลทรัพย์สิน",
      changedByUserId: user.id,
      changedBy: user.fullName,
    });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "information_assets", entityId: id, summary: `แก้ไขทรัพย์สิน ${input.assetName}` });
    revalidatePath("/assets");
    revalidatePath(`/assets/${id}`);
    revalidatePath("/");
    revalidatePath(`/facilities/${input.facilityId}`);
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function deleteAssetAction(id: number): Promise<string | null> {
  const user = await requireAuth();
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "assets.delete"))) return "สิทธิ์การลบทรัพย์สินถูกปิดใช้งาน";

  try {
    const asset = await getAssetById(id);
    if (!asset) return "ไม่พบทรัพย์สิน";
    if (!canManageAssetRecord(user, asset.facilityId)) return "คุณไม่มีสิทธิ์ลบทรัพย์สินของหน่วยงานนี้";
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
