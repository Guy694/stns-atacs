"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getAssetById, updateAsset } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";

export async function transferAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const assetId = Number(fd.get("assetId"));
  const newSurveyId = Number(fd.get("newSurveyId"));
  const newOwnerName = (fd.get("newOwnerName") as string | null)?.trim() || undefined;
  const newLocationDetail = (fd.get("newLocationDetail") as string | null)?.trim() || undefined;
  const reason = (fd.get("reason") as string | null)?.trim() || "";

  if (!assetId || isNaN(assetId)) return "ไม่พบ ID ทรัพย์สิน";
  if (!newSurveyId || isNaN(newSurveyId)) return "กรุณาเลือกหน่วยงานปลายทาง";

  try {
    const asset = await getAssetById(assetId);
    if (!asset) return "ไม่พบทรัพย์สิน";

    const transferNote = reason
      ? `[โอนย้าย] จาก ${asset.facilityName} (${asset.districtName}) → เหตุผล: ${reason} — บันทึกโดย ${user.fullName}`
      : `[โอนย้าย] จาก ${asset.facilityName} (${asset.districtName}) — บันทึกโดย ${user.fullName}`;

    await updateAsset(assetId, {
      surveyId: newSurveyId,
      ownerName: newOwnerName,
      locationDetail: newLocationDetail,
      usageDescription: transferNote,
      updatedBy: user.fullName,
      lastUpdatedAt: new Date().toISOString().slice(0, 10),
    });

    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
    revalidatePath("/");
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "transfer", entity: "information_assets", entityId: assetId, summary: transferNote });
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  redirect(`/assets/${assetId}`);
}
