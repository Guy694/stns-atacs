"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createRepair, getRepair, updateRepair } from "@/lib/asset-repairs";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { REPAIR_STATUS_LABELS, type RepairStatus } from "@/lib/repair-options";
import { hasPermission } from "@/lib/role-permissions";
import { friendlyLifecycleError } from "@/lib/schema-errors";

const text = (fd: FormData, key: string) => (fd.get(key) as string | null)?.trim() ?? "";

function revalidateRepair(assetId: number, repairId?: number) {
  revalidatePath("/repairs");
  if (repairId) revalidatePath(`/repairs/${repairId}`);
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/reports");
}

export async function createRepairAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "repairs.manage"))) return "คุณไม่มีสิทธิ์แจ้งซ่อม";
  const assetId = Number(fd.get("assetId"));
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return "ไม่พบทรัพย์สิน";

  let repairId: number;
  try {
    const asset = await getAssetById(assetId);
    if (!asset) return "ไม่พบทรัพย์สิน";
    if (!canManageAssetRecord(user, asset.facilityId)) return "คุณไม่มีสิทธิ์แจ้งซ่อมทรัพย์สินของหน่วยงานนี้";
    const result = await createRepair({
      assetId,
      problem: text(fd, "problem"),
      priority: text(fd, "priority") || "Normal",
      contact: text(fd, "contact"),
      markBroken: text(fd, "markBroken") === "1",
      userId: user.id,
      userName: user.fullName,
    });
    repairId = result.repairId;
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "create", entity: "asset_repairs", entityId: repairId, summary: `แจ้งซ่อม #${repairId} ${asset.assetName}${asset.assetRegistrationNo ? ` (${asset.assetRegistrationNo})` : ""}` });
    revalidateRepair(assetId, repairId);
  } catch (err) {
    return friendlyLifecycleError(err);
  }
  redirect(`/repairs/${repairId}`);
}

export async function updateRepairAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "repairs.manage"))) return "คุณไม่มีสิทธิ์ปรับสถานะงานซ่อม";
  const repairId = Number(fd.get("repairId"));
  if (!Number.isSafeInteger(repairId) || repairId <= 0) return "ไม่พบงานซ่อม";
  const costRaw = text(fd, "cost").replace(/,/g, "");
  const cost = fd.has("cost") ? (costRaw === "" ? null : Number(costRaw)) : undefined;
  if (cost != null && (!Number.isFinite(cost) || cost < 0)) return "ค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ";

  try {
    const repair = await getRepair(repairId);
    if (!repair) return "ไม่พบงานซ่อม";
    if (!canManageAssetRecord(user, repair.facilityId)) return "คุณไม่มีสิทธิ์จัดการงานซ่อมของหน่วยงานนี้";
    const optional = (key: string) => (fd.has(key) ? text(fd, key) : undefined);
    const result = await updateRepair({
      repairId,
      toStatus: text(fd, "status"),
      assignedTo: optional("assignedTo"),
      vendorName: optional("vendorName"),
      diagnosis: optional("diagnosis"),
      resolution: optional("resolution"),
      cost,
      note: text(fd, "note"),
      assetOutcome: text(fd, "assetOutcome") || undefined,
      userId: user.id,
      userName: user.fullName,
    });
    const statusText = result.fromStatus === result.toStatus ? "อัปเดตข้อมูล" : `${REPAIR_STATUS_LABELS[result.fromStatus as RepairStatus]} → ${REPAIR_STATUS_LABELS[result.toStatus]}`;
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "asset_repairs", entityId: repairId, summary: `งานซ่อม #${repairId}: ${statusText}` });
    revalidateRepair(result.assetId, repairId);
  } catch (err) {
    return friendlyLifecycleError(err);
  }
  return null;
}
