"use server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";
import { listAssetSubtypes } from "@/lib/asset-extensions";
import { ASSET_DETAIL_FIELDS } from "@/lib/asset-details";
import { executeStatement } from "@/lib/mysql";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getAssetSubtypeOptions() {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.role, "assets.view"))) throw new Error("ไม่มีสิทธิ์ดูประเภทย่อย");
  return listAssetSubtypes();
}

export async function saveAssetSubtype(_previous: string | null, form: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.role, "device-types.manage"))) return "ไม่มีสิทธิ์จัดการประเภทย่อย";
  const assetClass = String(form.get("assetClass") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const id = Number(form.get("id"));
  const active = form.get("isActive") === "1";
  if (!Object.hasOwn(ASSET_DETAIL_FIELDS, assetClass) || !name || name.length > 150) return "กรุณาเลือกกลุ่มและระบุชื่อไม่เกิน 150 ตัวอักษร";
  if (form.has("id") && (!Number.isSafeInteger(id) || id <= 0)) return "ประเภทย่อยไม่ถูกต้อง";
  try {
    const result = id
      ? await executeStatement("UPDATE asset_subtypes SET name = ?, is_active = ? WHERE id = ? AND asset_class = ?", [name, active ? 1 : 0, id, assetClass])
      : await executeStatement("INSERT INTO asset_subtypes (asset_class, name, is_active) VALUES (?, ?, 1)", [assetClass, name]);
    if (id && result.affectedRows === 0) return "ไม่พบประเภทย่อยในกลุ่มที่เลือก";
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: id ? "update" : "create", entity: "asset_subtypes", entityId: id || result.insertId, summary: `${id ? "แก้ไข" : "เพิ่ม"}ประเภทย่อย ${assetClass}: ${name}${id && !active ? " (ปิดใช้งาน)" : ""}` });
    revalidatePath("/assets/subtypes");
    revalidatePath("/assets");
    return null;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return "ชื่อประเภทย่อยนี้มีอยู่ในกลุ่มแล้ว";
    return "บันทึกไม่สำเร็จ กรุณาตรวจสอบฐานข้อมูลแล้วลองใหม่";
  }
}
