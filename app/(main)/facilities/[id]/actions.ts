"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getFacilityById, updateFacility } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/role-permissions";

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

  const facility = await getFacilityById(facilityId);
  if (!facility) return "ไม่พบหน่วยงานนี้";

  const name = (fd.get("name") as string | null)?.trim() ?? "";
  const tambon = (fd.get("tambon") as string | null)?.trim() ?? "";
  if (!name) return "กรุณากรอกชื่อหน่วยงาน";

  /**
   * SEC-01: `typecode` และ `district_name` เป็นตัวกำหนดขอบเขตสิทธิ์
   * (`managedAssetFacilityIds` ใน lib/auth.ts — หน่วยงานประเภท สสอ. ดูแลทั้งอำเภอ)
   * จึงให้แก้ได้เฉพาะผู้มีสิทธิ์ facilities.manage ค่าที่ส่งมาจากผู้ใช้ทั่วไปจะถูกมองข้าม
   */
  const canManageScope = await hasPermission(user.role, "facilities.manage");
  const requestedTypecode = (fd.get("typecode") as string | null)?.trim() ?? "";
  const requestedDistrict = (fd.get("districtName") as string | null)?.trim() ?? "";
  const scopeChangeRequested =
    (requestedTypecode && requestedTypecode !== (facility.typecode ?? "")) ||
    (requestedDistrict && requestedDistrict !== (facility.district_name ?? ""));

  if (scopeChangeRequested && !canManageScope) {
    await writeAuditLog({
      userId: user.id,
      userName: user.fullName,
      action: "update",
      entity: "health_facilities",
      entityId: facilityId,
      summary: `ปฏิเสธคำขอเปลี่ยนประเภท/อำเภอของหน่วยงาน ${facility.name} (ไม่มีสิทธิ์)`,
    });
    return "ประเภทหน่วยงานและอำเภอมีผลต่อสิทธิ์การเข้าถึงข้อมูล ต้องให้ผู้ดูแลระบบเป็นผู้แก้ไข";
  }

  const typecode = canManageScope && requestedTypecode ? requestedTypecode : undefined;
  const districtName = canManageScope && requestedDistrict ? requestedDistrict : undefined;
  if (canManageScope && !requestedTypecode) return "กรุณากรอกประเภทหน่วยงาน";
  if (canManageScope && !requestedDistrict) return "กรุณากรอกอำเภอ";

  try {
    await updateFacility(facilityId, {
      name,
      ...(typecode ? { typecode } : {}),
      ...(districtName ? { districtName } : {}),
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