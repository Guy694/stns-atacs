"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { updateFacility } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";

function parseNumber(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function updateFacilitySelfAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "viewer") return "คุณไม่มีสิทธิ์ดำเนินการนี้";

  const facilityId = Number(fd.get("facilityId"));
  if (!facilityId || Number.isNaN(facilityId)) return "ไม่พบ ID หน่วยงาน";
  if (user.role === "officer" && user.facilityId !== facilityId) return "คุณไม่มีสิทธิ์แก้ไขหน่วยงานนี้";

  const name = (fd.get("name") as string | null)?.trim() ?? "";
  const typecode = (fd.get("typecode") as string | null)?.trim() ?? "";
  const districtName = (fd.get("districtName") as string | null)?.trim() ?? "";
  const tambon = (fd.get("tambon") as string | null)?.trim() ?? "";

  if (!name) return "กรุณากรอกชื่อหน่วยงาน";
  if (!typecode) return "กรุณากรอกประเภทหน่วยงาน";
  if (!districtName) return "กรุณากรอกอำเภอ";

  try {
    await updateFacility(facilityId, {
      name,
      typecode,
      districtName,
      tambon,
      lat: parseNumber(fd.get("lat")),
      lon: parseNumber(fd.get("lon")),
    });

    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "update",
      entity: "health_facilities",
      entityId: facilityId,
      summary: `แก้ไขข้อมูลหน่วยงาน ${name}`,
    });

    revalidatePath(`/facilities/${facilityId}`);
    revalidatePath("/assets");
    revalidatePath("/reports");
    revalidatePath("/admin/settings/facilities");
  } catch (error) {
    return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  return null;
}