"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getAssetById, getSurveyById } from "@/lib/assets";
import { transferAsset } from "@/lib/asset-transfers";
import { writeAuditLog } from "@/lib/audit";
import { canManageAsset, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { friendlyLifecycleError } from "@/lib/schema-errors";

function text(fd: FormData, key: string) {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

export async function transferAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (!(await hasPermission(user.role, "transfer.manage"))) return "สิทธิ์การโอนย้ายถูกปิดใช้งาน";

  const assetId = Number(fd.get("assetId"));
  const newSurveyId = Number(fd.get("newSurveyId"));
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return "ไม่พบ ID ทรัพย์สิน";
  if (!Number.isSafeInteger(newSurveyId) || newSurveyId <= 0) return "กรุณาเลือกหน่วยงานปลายทาง";

  let workGroupId: number | null | undefined;
  if (fd.has("newWorkGroupId")) {
    const raw = text(fd, "newWorkGroupId");
    workGroupId = raw ? Number(raw) : null;
    if (workGroupId !== null && (!Number.isSafeInteger(workGroupId) || workGroupId <= 0)) return "กลุ่มงานไม่ถูกต้อง";
  }

  try {
    const [asset, destinationSurvey] = await Promise.all([getAssetById(assetId), getSurveyById(newSurveyId)]);
    if (!asset) return "ไม่พบทรัพย์สิน";
    if (!destinationSurvey) return "ไม่พบหน่วยงานปลายทาง";
    if (!canManageAsset(user, asset.facilityId)) return "คุณไม่มีสิทธิ์โอนย้ายทรัพย์สินของหน่วยงานนี้";
    if (!canManageAsset(user, destinationSurvey.facilityId)) return "คุณไม่มีสิทธิ์โอนย้ายไปหน่วยงานปลายทางนี้";

    const result = await transferAsset({
      assetId,
      toSurveyId: newSurveyId,
      toWorkGroupId: workGroupId,
      toOwnerName: fd.has("newOwnerName") ? text(fd, "newOwnerName") : undefined,
      toLocationDetail: fd.has("newLocationDetail") ? text(fd, "newLocationDetail") : undefined,
      reason: text(fd, "reason"),
      documentNo: text(fd, "documentNo"),
      transferDate: text(fd, "transferDate") || new Date().toISOString().slice(0, 10),
      userId: user.id,
      userName: user.fullName,
    });

    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "transfer", entity: "information_assets", entityId: assetId, summary: `${result.note} (โอนย้าย #${result.transferId})` });
    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
    revalidatePath("/transfer");
    revalidatePath(`/facilities/${result.fromFacilityId}`);
    revalidatePath(`/facilities/${result.toFacilityId}`);
    revalidatePath("/");
  } catch (err) {
    return friendlyLifecycleError(err);
  }

  redirect(`/assets/${assetId}`);
}
