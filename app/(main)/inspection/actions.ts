"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAssetStatusHistory } from "@/lib/asset-status-history";
import { writeAuditLog } from "@/lib/audit";
import { createInspection, getInspectionItemContext, updateInspectionItem } from "@/lib/inspection";
import { getCurrentUser } from "@/lib/auth";
import { listAssets, updateAsset } from "@/lib/assets";
import { canManageFacility, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

const VALID_ASSET_STATUSES = new Set(["Active", "Inactive", "Broken", "Disposed", "Lost"]);

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

  const scopedAssets = await listAssets({ facilityId });
  if (scopedAssets.length === 0) return "ไม่พบรายการครุภัณฑ์ในหน่วยงานนี้";
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
      items,
    });

    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "inspect",
      entity: "asset_inspections",
      entityId: inspectionId,
      summary: `เปิดรอบตรวจนับ ${roundName} หน่วยบริการ ${facilityId} ช่วง ${startDate} ถึง ${endDate} จำนวน ${items.length} รายการ`,
    });
  } catch (e) {
    console.error(e);
    return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  redirect(`/inspection/${inspectionId}`);
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
  redirect(`/inspection/${item.inspectionId}`);
}
