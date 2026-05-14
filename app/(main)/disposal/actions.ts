"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getAssetById, updateAsset } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";

export type DisposalType = "Broken" | "Inactive" | "Disposed" | "Lost";

export async function disposalAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "viewer") return "คุณไม่มีสิทธิ์ดำเนินการนี้";

  const assetId = Number(fd.get("assetId"));
  const disposalType = fd.get("disposalType") as DisposalType;
  const reason = (fd.get("reason") as string | null)?.trim() || "";
  const noteDate = (fd.get("noteDate") as string | null)?.trim() || new Date().toISOString().slice(0, 10);

  if (!assetId || isNaN(assetId)) return "ไม่พบ ID ทรัพย์สิน";
  if (!disposalType || !["Broken", "Inactive", "Disposed", "Lost"].includes(disposalType)) {
    return "กรุณาเลือกประเภทการดำเนินการ";
  }
  if (!reason) return "กรุณาระบุเหตุผล";

  const labelMap: Record<DisposalType, string> = {
    Broken: "บันทึกชำรุด",
    Inactive: "ระงับการใช้งาน",
    Disposed: "จำหน่ายออก",
    Lost: "สูญหาย",
  };

  try {
    const asset = await getAssetById(assetId);
    if (!asset) return "ไม่พบทรัพย์สิน";

    const note = `[${labelMap[disposalType]}] ${noteDate} — ${reason} — บันทึกโดย ${user.fullName}`;

    const statusMap: Record<DisposalType, string> = {
      Broken: "Broken",
      Inactive: "Inactive",
      Disposed: "Inactive",
      Lost: "Inactive",
    };

    await updateAsset(assetId, {
      currentStatus: statusMap[disposalType],
      usageDescription: note,
      updatedBy: user.fullName,
      lastUpdatedAt: new Date().toISOString().slice(0, 10),
    });

    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
    revalidatePath("/");
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "dispose", entity: "information_assets", entityId: assetId, summary: note });
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  redirect(`/assets/${assetId}`);
}
