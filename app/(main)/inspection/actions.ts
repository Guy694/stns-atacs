"use server";

import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { createInspection } from "@/lib/inspection";
import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { canManageFacility, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

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
  const note = String(formData.get("note") ?? "").trim();

  if (!facilityId || !roundName) return "กรุณากรอกข้อมูลให้ครบถ้วน";
  if (!canManageFacility(user, facilityId)) return "คุณไม่มีสิทธิ์ตรวจนับหน่วยงานนี้";

  // Collect item results from form (assetId_found, assetId_note)
  const assetIds = (formData.getAll("assetId") as string[]).map(Number);
  const scopedAssets = await listAssets({ facilityId });
  const allowedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
  if (assetIds.some((assetId) => !allowedAssetIds.has(assetId))) {
    return "มีรายการทรัพย์สินที่ไม่อยู่ในหน่วยงานที่คุณเลือก";
  }
  const items = assetIds.map((assetId) => ({
    assetId,
    found: formData.get(`found_${assetId}`) === "1",
    conditionNote: String(formData.get(`conditionNote_${assetId}`) ?? "").trim() || undefined,
  }));

  let inspectionId: number;
  try {
    inspectionId = await createInspection({
      facilityId,
      roundName,
      inspectedBy: user.fullName,
      note: note || undefined,
      items,
    });

    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "inspect",
      entity: "asset_inspections",
      entityId: inspectionId,
      summary: `ตรวจนับทรัพย์สิน ${roundName} หน่วยบริการ ${facilityId} จำนวน ${items.length} รายการ`,
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
