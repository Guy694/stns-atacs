"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isTerminalAssetStatus, OPERATIONAL_ASSET_STATUSES } from "@/lib/asset-status";
import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { writeAuditLog } from "@/lib/audit";
import {
  COMMITTEE_SIZE,
  createInspection,
  deleteInspection,
  getInspectionById,
  getInspectionItemContext,
  normalizeCommittee,
  saveInspectionCommittee,
  setInspectionRoundStatus,
  updateInspectionItem,
} from "@/lib/inspection";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { friendlyLifecycleError } from "@/lib/schema-errors";
import { getCurrentUser } from "@/lib/auth";
import { listAssets, updateAsset } from "@/lib/assets";
import { canManageFacility, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

// Inspections record condition only; disposal/loss requires an approved request.
const VALID_ASSET_STATUSES = new Set<string>(OPERATIONAL_ASSET_STATUSES);

function readDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export async function createInspectionAction(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "กรุณาเข้าสู่ระบบ";
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "inspection.create"))) return "สิทธิ์การสร้างรอบตรวจนับถูกปิดใช้งาน";

  const facilityId = Number(formData.get("facilityId"));
  const roundName = String(formData.get("roundName") ?? "").trim();
  const startDate = readDate(formData.get("startDate"));
  const endDate = readDate(formData.get("endDate"));
  const note = String(formData.get("note") ?? "").trim();

  if (!facilityId || !roundName || !startDate || !endDate) return "กรุณากรอกข้อมูลให้ครบถ้วน";
  if (endDate < startDate) return "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มตรวจ";
  if (!canManageFacility(user, facilityId)) return "คุณไม่มีสิทธิ์ตรวจนับหน่วยงานนี้";

  const workGroupRaw = String(formData.get("workGroupId") ?? "").trim();
  const workGroupId = workGroupRaw ? Number(workGroupRaw) : null;
  let workGroupName = "";
  if (workGroupId !== null) {
    const group = (await listFacilityWorkGroups(facilityId)).find((item) => item.id === workGroupId);
    if (!group) return "กลุ่มงานไม่อยู่ในหน่วยงานที่เลือก";
    workGroupName = group.workGroupName;
  }
  let committee;
  try {
    committee = readCommittee(formData);
  } catch (error) {
    return error instanceof Error ? error.message : "ข้อมูลคณะกรรมการไม่ถูกต้อง";
  }

  // Disposed/Lost assets are no longer on hand and are not counted in a new round.
  const scopedAssets = (await listAssets({ facilityId, workGroupId: workGroupId ?? undefined }))
    .filter((asset) => !isTerminalAssetStatus(asset.currentStatus));
  if (scopedAssets.length === 0) return workGroupId ? "ไม่พบรายการครุภัณฑ์ในกลุ่มงานนี้" : "ไม่พบรายการครุภัณฑ์ในหน่วยงานนี้";
  const items = scopedAssets.map((asset) => ({ assetId: asset.id }));

  let inspectionId: number;
  try {
    inspectionId = await createInspection({
      facilityId,
      roundName,
      inspectedBy: user.fullName,
      startDate,
      endDate,
      note: note || undefined,
      workGroupId,
      committee,
      items,
    });

    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "inspect",
      entity: "asset_inspections",
      entityId: inspectionId,
      summary: `เปิดรอบตรวจนับ ${roundName} หน่วยบริการ ${facilityId}${workGroupName ? ` กลุ่มงาน ${workGroupName}` : ""} ช่วง ${startDate} ถึง ${endDate} จำนวน ${items.length} รายการ`,
    });
  } catch (e) {
    console.error(e);
    return friendlyLifecycleError(e, "เกิดข้อผิดพลาด กรุณาลองใหม่").replace("add_asset_lifecycle.sql", "add_asset_codes_and_inspection_committee.sql");
  }

  redirect(`/inspection/${inspectionId}`);
}

function readCommittee(formData: FormData) {
  return normalizeCommittee(Array.from({ length: COMMITTEE_SIZE }, (_, index) => ({
    fullName: String(formData.get(`committeeName${index + 1}`) ?? ""),
    position: String(formData.get(`committeePosition${index + 1}`) ?? ""),
    role: String(formData.get(`committeeRole${index + 1}`) ?? ""),
  })));
}

export async function saveCommitteeAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "inspection.create"))) return "คุณไม่มีสิทธิ์แก้ไขคณะกรรมการ";
  const inspectionId = Number(formData.get("inspectionId"));
  const inspection = Number.isSafeInteger(inspectionId) && inspectionId > 0 ? await getInspectionById(inspectionId) : null;
  if (!inspection) return "ไม่พบรอบตรวจนับ";
  if (!canManageFacility(user, inspection.facilityId)) return "คุณไม่มีสิทธิ์จัดการรอบตรวจนับของหน่วยงานนี้";
  if (inspection.roundStatus === "Closed") return "รอบนี้ปิดแล้ว ต้องเปิดรอบก่อนแก้ไขคณะกรรมการ";
  try {
    const members = readCommittee(formData);
    await saveInspectionCommittee(inspectionId, members);
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "asset_inspections", entityId: inspectionId, summary: `แก้ไขคณะกรรมการตรวจนับ ${inspection.roundName}: ${members.map((m) => m.fullName).join(", ") || "-"}` });
  } catch (error) {
    return friendlyLifecycleError(error).replace("add_asset_lifecycle.sql", "add_asset_codes_and_inspection_committee.sql");
  }
  revalidatePath(`/inspection/${inspectionId}`);
  return "saved";
}

export async function getAssetsForFacility(facilityId: number) {
  "use server";
  const user = await getCurrentUser();
  if (!user) return [];
  if (!(await hasPermission(user.role, "inspection.view"))) return [];
  if (!canManageFacility(user, facilityId)) return [];
  return listAssets({ facilityId });
}

export async function updateInspectionItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) redirect("/inspection");
  if (!(await hasPermission(user.role, "inspection.create"))) redirect("/inspection");

  const itemId = Number(formData.get("itemId"));
  const inspectionStatus = String(formData.get("inspectionStatus") ?? "").trim();
  const assetStatus = String(formData.get("assetStatus") ?? "").trim();
  const conditionNote = String(formData.get("conditionNote") ?? "").trim();

  if (!itemId || (inspectionStatus !== "Found" && inspectionStatus !== "Missing") || !VALID_ASSET_STATUSES.has(assetStatus)) {
    redirect("/inspection");
  }

  const item = await getInspectionItemContext(itemId);
  if (!item) redirect("/inspection");
  const round = await getInspectionById(item.inspectionId);
  if (round?.roundStatus === "Closed") redirect(`/inspection/${item.inspectionId}?locked=1`);
  if (isTerminalAssetStatus(item.currentStatus)) redirect(`/inspection/${item.inspectionId}`);
  if (!canManageFacility(user, item.facilityId)) redirect(`/inspection/${item.inspectionId}`);

  await updateInspectionItem({
    itemId,
    inspectionStatus,
    assetStatus,
    conditionNote,
    checkedBy: user.fullName,
  });

  if ((item.currentStatus ?? "") !== assetStatus) {
    await updateAsset(item.assetId, {
      currentStatus: assetStatus,
      updatedBy: user.fullName,
      lastUpdatedAt: new Date().toISOString().slice(0, 10),
    });
    await recordAssetStatusHistory({
      assetId: item.assetId,
      fromStatus: item.currentStatus,
      toStatus: assetStatus,
      note: conditionNote || `อัปเดตจากรอบตรวจนับ #${item.inspectionId}`,
      changedByUserId: user.id,
      changedBy: user.fullName,
    });
  }

  await writeAuditLog({
    userId: user.id,
    userName: user.fullName,
    action: "inspect",
    entity: "asset_inspection_items",
    entityId: itemId,
    summary: `ตรวจครุภัณฑ์ ${item.assetId}: ${inspectionStatus}, สถานะ ${assetStatus}`,
  });

  revalidatePath(`/inspection/${item.inspectionId}`);
  revalidatePath(`/assets/${item.assetId}`);
  // Check-in from the asset page (after scanning a QR) returns there; only same-site asset paths are allowed.
  const returnTo = String(formData.get("returnTo") ?? "");
  if (returnTo === `/assets/${item.assetId}`) redirect(`${returnTo}?checked=${item.inspectionId}`);
  redirect(`/inspection/${item.inspectionId}`);
}

/** Permanently deletes one round and its results; asset statuses are not changed. */
export async function deleteInspectionAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "inspection.create"))) return "สิทธิ์การจัดการรอบตรวจนับถูกปิดใช้งาน";

  const inspectionId = Number(formData.get("inspectionId"));
  if (!Number.isSafeInteger(inspectionId) || inspectionId <= 0) return "ไม่พบรอบตรวจนับ";
  const inspection = await getInspectionById(inspectionId);
  if (!inspection) return "ไม่พบรอบตรวจนับ";
  if (!canManageFacility(user, inspection.facilityId)) return "คุณไม่มีสิทธิ์จัดการรอบตรวจนับของหน่วยงานนี้";
  if (inspection.roundStatus === "Closed") return "รอบนี้ปิดแล้ว ต้องเปิดรอบก่อนจึงจะลบได้";
  // Typing the round name guards against deleting the wrong round.
  if (String(formData.get("confirmName") ?? "").trim() !== inspection.roundName.trim()) return "ชื่อรอบที่พิมพ์ยืนยันไม่ตรงกับชื่อรอบตรวจนับ";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

  try {
    const { deletedItems } = await deleteInspection(inspectionId);
    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "delete",
      entity: "asset_inspections",
      entityId: inspectionId,
      summary: `ลบรอบตรวจนับ "${inspection.roundName}" (${inspection.facilityName}) พร้อมผลตรวจ ${deletedItems} รายการ · ตรวจแล้ว ${inspection.checkedItems}/${inspection.totalItems}${reason ? ` — ${reason}` : ""}`,
    });
  } catch (error) {
    return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  revalidatePath("/inspection");
  redirect("/inspection");
}

/** Close (lock results) or reopen a round. Closing with unchecked items requires an explicit tick. */
export async function setRoundStatusAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "inspection.create"))) return "คุณไม่มีสิทธิ์ปิดหรือเปิดรอบตรวจนับ";
  const inspectionId = Number(formData.get("inspectionId"));
  const next = String(formData.get("status") ?? "");
  if (next !== "Open" && next !== "Closed") return "สถานะรอบไม่ถูกต้อง";
  const inspection = Number.isSafeInteger(inspectionId) && inspectionId > 0 ? await getInspectionById(inspectionId) : null;
  if (!inspection) return "ไม่พบรอบตรวจนับ";
  if (!canManageFacility(user, inspection.facilityId)) return "คุณไม่มีสิทธิ์จัดการรอบตรวจนับของหน่วยงานนี้";
  if (next === "Closed" && inspection.remainingItems > 0 && formData.get("confirmPending") !== "1") {
    return `ยังมี ${inspection.remainingItems} รายการที่ยังไม่ได้ตรวจ กรุณายืนยันการปิดรอบ`;
  }
  try {
    const changed = await setInspectionRoundStatus(inspectionId, next, user.fullName);
    if (!changed) return next === "Closed" ? "รอบนี้ปิดไปแล้ว" : "รอบนี้เปิดอยู่แล้ว";
    await writeAuditLog({
      userId: user.id, userName: user.fullName, action: "inspect", entity: "asset_inspections", entityId: inspectionId,
      summary: `${next === "Closed" ? "ปิดรอบ" : "เปิดรอบอีกครั้ง"} ${inspection.roundName} (ตรวจแล้ว ${inspection.checkedItems}/${inspection.totalItems})`,
    });
  } catch (error) {
    return friendlyLifecycleError(error).replace("add_asset_lifecycle.sql", "add_inspection_close.sql");
  }
  revalidatePath(`/inspection/${inspectionId}`);
  revalidatePath("/inspection");
  return null;
}
