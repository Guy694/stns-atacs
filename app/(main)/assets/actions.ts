"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { parseAssetFields, type AssetFields } from "@/lib/asset-input";
import { findActiveFacilityWorkGroup, findOrCreateFacilityWorkGroup } from "@/lib/facility-work-groups";
import { isMissingSchemaError } from "@/lib/schema-errors";
import { getCurrentUser } from "@/lib/auth";
import { detectImageExtension } from "@/lib/announcement-shared";
import { createAsset, deleteAsset, findOrCreateSurvey, getAssetById, updateAsset, type AssetInput, type AssetWithFacility } from "@/lib/assets";
import { writeAuditLogSafe } from "@/lib/audit";
import { ASSET_IMAGE_URL_PREFIX, assetImageDir, assetImageUrl, safeAssetImageName } from "@/lib/upload-storage";
import { selectRows } from "@/lib/mysql";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission, type AppRole } from "@/lib/role-permissions";
import { assetNotDeletedSql, hasAssetSoftDelete } from "@/lib/asset-soft-delete";
import { todayBangkok } from "@/lib/local-date";

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
const FACILITY_CHANGE_MESSAGE = "การย้ายหน่วยงานต้องทำผ่านเมนูโอนย้ายทรัพย์สิน";

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readFile(fd: FormData, key: string) {
  const file = fd.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

async function storeAssetImage(file: File, slot: 1 | 2) {
  if (file.size > MAX_ASSET_IMAGE_BYTES) {
    throw new Error("รูปภาพต้องมีขนาดไม่เกิน 5MB ต่อภาพ");
  }
  // The type is read from the file's own bytes; the browser-sent Content-Type is not trusted.
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = detectImageExtension(bytes);
  if (!extension) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP");
  }

  // Stored outside public/ and served by app/uploads/assets/[file] (login + facility check).
  const uploadDir = assetImageDir();
  await mkdir(uploadDir, { recursive: true });

  const filename = `asset-${Date.now()}-${slot}-${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);

  return assetImageUrl(filename);
}

/**
 * Best-effort removal of a photo file that no asset uses any more. Only plain file names under the
 * asset upload folder are touched, and never a file another asset row (including a soft-deleted one) still references.
 */
async function removeStoredAssetImage(url: string | null | undefined) {
  try {
    if (!url || !url.startsWith(ASSET_IMAGE_URL_PREFIX)) return;
    const name = safeAssetImageName(url.slice(ASSET_IMAGE_URL_PREFIX.length));
    if (!name) return;
    const uploadDir = path.resolve(assetImageDir());
    const file = path.resolve(uploadDir, name);
    if (path.dirname(file) !== uploadDir) return;
    const stillUsed = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM information_assets WHERE asset_image_1_url = ? OR asset_image_2_url = ? LIMIT 1",
      [url, url]
    );
    if (stillUsed.length) return;
    await unlink(file);
  } catch (error) {
    console.warn("[assets] could not remove replaced asset photo", url, error instanceof Error ? error.message : error);
  }
}

type AssetImageUrls = { assetImage1Url: string | null; assetImage2Url: string | null };

async function buildAssetImageUrls(fd: FormData, currentAsset?: AssetWithFacility | null): Promise<AssetImageUrls & { stored: string[] }> {
  const firstFile = readFile(fd, "assetImage1");
  const secondFile = readFile(fd, "assetImage2");
  const removeFirst = readStr(fd, "removeAssetImage1") === "1";
  const removeSecond = readStr(fd, "removeAssetImage2") === "1";
  const stored: string[] = [];
  const store = async (file: File, slot: 1 | 2) => {
    const url = await storeAssetImage(file, slot);
    stored.push(url);
    return url;
  };

  try {
    return {
      assetImage1Url: firstFile
        ? await store(firstFile, 1)
        : removeFirst
          ? null
          : currentAsset?.assetImage1Url || null,
      assetImage2Url: secondFile
        ? await store(secondFile, 2)
        : removeSecond
          ? null
          : currentAsset?.assetImage2Url || null,
      stored,
    };
  } catch (error) {
    await Promise.all(stored.map(removeStoredAssetImage));
    throw error;
  }
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

  const today = parseDateOnly(todayBangkok());
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
    // Deleted assets keep their number: the trail stays unambiguous and the UNIQUE (survey_id, asset_registration_no) key still covers them.
    const duplicateRows = await selectRows<RowDataPacket & { id: number; deleted: number }>(
      `SELECT id, ${(await hasAssetSoftDelete()) ? "deleted_at IS NOT NULL" : "0"} AS deleted
       FROM information_assets
       WHERE asset_registration_no = ?
         AND (? IS NULL OR id <> ?)
       LIMIT 1`,
      [input.assetRegistrationNo, assetId ?? null, assetId ?? null]
    );
    if (duplicateRows.length > 0) {
      throw new Error(Number(duplicateRows[0].deleted) ? DELETED_REGISTRATION_MESSAGE : "เลขทะเบียนทรัพย์สินนี้มีในระบบแล้ว");
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
         AND ${await assetNotDeletedSql("a")}
       LIMIT 1`,
      [input.facilityId, serial, assetId ?? null, assetId ?? null]
    );

    if (duplicateSerialRows.length > 0) {
      throw new Error("Serial Number นี้มีอยู่แล้วในหน่วยงานนี้");
    }
  }
}

const DELETED_REGISTRATION_MESSAGE = "เลขทะเบียนทรัพย์สินนี้เคยใช้กับทรัพย์สินที่ถูกลบไปแล้ว จึงใช้ซ้ำไม่ได้ กรุณาใช้เลขทะเบียนอื่น หรือติดต่อผู้ดูแลระบบ";

function assetErrorMessage(err: unknown) {
  if (isMissingSchemaError(err)) return "ฐานข้อมูลยังไม่รองรับข้อมูลบางช่อง (เช่น แหล่งเงิน วิธีได้มา ผู้ขาย ประกัน หน่วยนับ) กรุณาให้ผู้ดูแลระบบรัน database/add_registry_completeness.sql หรือเว้นช่องเหล่านี้ว่างไว้ก่อน";
  return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

/** เพิ่มกลุ่มงานใหม่จากแบบฟอร์มได้เมื่อมีสิทธิ์จัดการกลุ่มงาน */
async function canAddWorkGroups(user: { role: AppRole }) {
  return user.role === "admin" || (await hasPermission(user.role, "work-groups.manage"));
}

async function buildInput(
  fd: FormData,
  updaterName: string,
  currentAsset?: AssetWithFacility,
  canAddWorkGroup = false
): Promise<AssetFormInput> {
  const facilityId = Number(fd.get("facilityId"));
  if (!Number.isSafeInteger(facilityId) || facilityId <= 0) throw new Error("กรุณาเลือกหน่วยงาน");
  const fields: AssetFields = {};
  for (const [key, value] of fd.entries()) if (typeof value === "string") fields[key] = value.trim();
  const parsed = parseAssetFields(fields, currentAsset);
  const workGroupIdRaw = readOptional(fd, "workGroupId");
  let workGroupId = currentAsset?.workGroupId ?? null;
  if (fd.has("workGroupId")) {
    workGroupId = workGroupIdRaw ? Number(workGroupIdRaw) : null;
    if (workGroupId !== null && (!Number.isSafeInteger(workGroupId) || workGroupId <= 0)) throw new Error("กลุ่มงานไม่ถูกต้อง");
  }
  /**
   * กรอกกลุ่มงานเป็นข้อความได้ (เช่น งานธุรการ, สสอ., รพ.สต.)
   * ถ้ายังไม่มีในหน่วยงานนั้น ระบบสร้างให้จากหน้าแบบฟอร์มเลย ไม่ต้องไปหน้าตั้งค่าก่อน
   * ถ้าเลือกจากรายการอยู่แล้ว (มี workGroupId) จะใช้ค่านั้นเป็นหลัก
   */
  const workGroupName = readOptional(fd, "workGroupName");
  if (!workGroupId && workGroupName) {
    const existing = await findActiveFacilityWorkGroup(facilityId, workGroupName);
    if (existing) {
      workGroupId = existing.id;
    } else {
      if (!canAddWorkGroup) {
        throw new Error(`ไม่พบกลุ่มงาน "${workGroupName}" ในหน่วยงานนี้ และบัญชีของคุณไม่มีสิทธิ์เพิ่มกลุ่มงานใหม่ กรุณาเลือกจากรายการหรือติดต่อผู้ดูแลระบบ`);
      }
      workGroupId = await findOrCreateFacilityWorkGroup(facilityId, workGroupName);
      if (!workGroupId) throw new Error("ชื่อกลุ่มงานไม่ถูกต้อง");
    }
  }
  const surveyId = currentAsset?.facilityId === facilityId ? currentAsset.surveyId : await findOrCreateSurvey(facilityId);
  return { ...parsed, surveyId, workGroupId, facilityId, updatedBy: updaterName, lastUpdatedAt: todayBangkok() };
}

export async function createAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "assets.create"))) return "สิทธิ์การเพิ่มทรัพย์สินถูกปิดใช้งาน";

  try {
    const requestedFacilityId = Number(fd.get("facilityId"));
    if (!requestedFacilityId || isNaN(requestedFacilityId)) return "กรุณาเลือกหน่วยงาน";
    if (!canManageAssetRecord(user, requestedFacilityId)) return "คุณไม่มีสิทธิ์ดำเนินการกับหน่วยงานนี้";
    const input = await buildInput(fd, user.fullName, undefined, await canAddWorkGroups(user));
    await validateAssetBusinessRules(input);
    const { stored, ...imageUrls } = await buildAssetImageUrls(fd);
    let result;
    try {
      // Asset + first status-history row commit together; the audit entry after commit never fails the save.
      result = await createAsset({ ...input, ...imageUrls }, {
        history: { note: "สร้างทะเบียนทรัพย์สิน", toStatus: input.currentStatus ?? "Active", changedByUserId: user.id, changedBy: user.fullName },
      });
    } catch (error) {
      await Promise.all(stored.map(removeStoredAssetImage));
      throw error;
    }
    const newId = result.insertId;
    await writeAuditLogSafe({ userId: user.id, userName: user.fullName, action: "create", entity: "information_assets", entityId: newId, summary: input.assetRegistrationNo ? `สร้างทรัพย์สิน ${input.assetName} (${input.assetRegistrationNo})` : `สร้างทรัพย์สิน ${input.assetName}` });
    revalidatePath("/assets");
    revalidatePath("/");
  } catch (err) {
    return assetErrorMessage(err);
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
    // Moving between facilities must go through /transfer (open-work checks, transfer record, history).
    if (requestedFacilityId !== Number(currentAsset.facilityId)) return FACILITY_CHANGE_MESSAGE;
    const input = await buildInput(fd, user.fullName, currentAsset, await canAddWorkGroups(user));
    if (input.assetClass !== currentAsset.assetClass && readStr(fd, "confirmClassChange") !== "1") return "กรุณายืนยันการเปลี่ยนกลุ่มทรัพย์สิน";
    await validateAssetBusinessRules(input, id);
    const { stored, ...imageUrls } = await buildAssetImageUrls(fd, currentAsset);
    try {
      await updateAsset(id, { ...input, ...imageUrls }, {
        history: {
          note: "แก้ไขข้อมูลทรัพย์สิน",
          fromStatus: currentAsset.currentStatus,
          toStatus: input.currentStatus ?? currentAsset.currentStatus,
          changedByUserId: user.id,
          changedBy: user.fullName,
        },
      });
    } catch (error) {
      await Promise.all(stored.map(removeStoredAssetImage));
      throw error;
    }
    // Photos replaced or removed by this save are no longer referenced by the asset.
    const kept = new Set([imageUrls.assetImage1Url, imageUrls.assetImage2Url]);
    await Promise.all(
      [currentAsset.assetImage1Url, currentAsset.assetImage2Url]
        .filter((url) => url && !kept.has(url))
        .map(removeStoredAssetImage)
    );
    await writeAuditLogSafe({ userId: user.id, userName: user.fullName, action: "update", entity: "information_assets", entityId: id, summary: `แก้ไขทรัพย์สิน ${input.assetName}${currentAsset.assetClass !== input.assetClass ? ` (เปลี่ยนกลุ่ม ${currentAsset.assetClass} → ${input.assetClass})` : ""}` });
    revalidatePath("/assets");
    revalidatePath(`/assets/${id}`);
    revalidatePath("/");
    revalidatePath(`/facilities/${input.facilityId}`);
  } catch (err) {
    return assetErrorMessage(err);
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
    // Soft delete: refused while repairs, loans or disposals are still open (see lib/assets.ts deleteAsset).
    await deleteAsset(id, { userId: user.id, userName: user.fullName });
    await writeAuditLogSafe({ userId: user.id, userName: user.fullName, action: "delete", entity: "information_assets", entityId: id, summary: `ลบทรัพย์สิน #${id}${asset.assetNumber ? ` ${asset.assetNumber}` : ""} ${asset.assetName}`.trim() });
    revalidatePath("/assets");
    revalidatePath(`/facilities/${asset.facilityId}`);
    revalidatePath("/");
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}
