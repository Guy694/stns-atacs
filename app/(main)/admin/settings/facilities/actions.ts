"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { createFacility, toggleFacilityActive, updateFacility } from "@/lib/assets";
import { canAccessFacility } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowManageFacilities = user.role === "admin" || (await hasPermission(user.role, "facilities.manage"));
  if (!allowManageFacilities) redirect("/dashboard");
  return user;
}

function str(fd: FormData, key: string) {
  return (fd.get(key) as string | null)?.trim() ?? "";
}
function optStr(fd: FormData, key: string) {
  const v = str(fd, key);
  return v || undefined;
}
function optFloat(fd: FormData, key: string) {
  const v = str(fd, key);
  if (!v) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

const REVALIDATE = () => {
  revalidatePath("/admin/settings/facilities");
  revalidatePath("/assets");
  revalidatePath("/facilities");
};

export async function createFacilityAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAdmin();
  if (user.role !== "admin") return "เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มหน่วยงานได้";
  const name = str(fd, "name");
  const typecode = str(fd, "typecode");
  const districtName = str(fd, "districtName");
  if (!name) return "กรุณากรอกชื่อหน่วยงาน";
  if (!typecode) return "กรุณาเลือกประเภทหน่วยงาน";
  if (!districtName) return "กรุณาเลือกอำเภอ";
  try {
    await createFacility({
      name,
      typecode,
      districtName,
      tambon: optStr(fd, "tambon"),
      lat: optFloat(fd, "lat"),
      lon: optFloat(fd, "lon"),
      assetCodePrefix: optStr(fd, "assetCodePrefix")?.slice(0, 30),
    });
    REVALIDATE();
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }
  return null;
}

export async function updateFacilityAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id) return "ไม่พบ ID หน่วยงาน";
  if (!canAccessFacility(user, id)) return "คุณไม่มีสิทธิ์แก้ไขหน่วยงานนี้";
  const name = str(fd, "name");
  if (!name) return "กรุณากรอกชื่อหน่วยงาน";
  /**
   * SEC-01: ประเภทหน่วยงาน (สสอ. ⇒ ดูแลทั้งอำเภอ) และอำเภอ เป็นตัวกำหนดขอบเขตสิทธิ์
   * บทบาทที่ได้สิทธิ์ facilities.manage แต่ไม่ใช่แอดมิน จึงแก้สองช่องนี้ไม่ได้
   */
  const scopeTypecode = optStr(fd, "typecode");
  const scopeDistrict = optStr(fd, "districtName");
  if (user.role !== "admin" && (scopeTypecode || scopeDistrict)) {
    return "ประเภทหน่วยงานและอำเภอมีผลต่อสิทธิ์การเข้าถึงข้อมูล ต้องให้ผู้ดูแลระบบเป็นผู้แก้ไข";
  }
  try {
    await updateFacility(id, {
      name,
      typecode: user.role === "admin" ? scopeTypecode : undefined,
      districtName: user.role === "admin" ? scopeDistrict : undefined,
      tambon: optStr(fd, "tambon"),
      lat: optFloat(fd, "lat"),
      lon: optFloat(fd, "lon"),
      assetCodePrefix: fd.has("assetCodePrefix") ? str(fd, "assetCodePrefix").slice(0, 30) : undefined,
    });
    REVALIDATE();
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }
  return null;
}

export async function toggleFacilityActiveAction(id: number, active: boolean): Promise<void> {
  const user = await requireAdmin();
  if (user.role !== "admin") return;
  await toggleFacilityActive(id, active);
  REVALIDATE();
}
