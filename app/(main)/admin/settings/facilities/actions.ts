"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { createFacility, toggleFacilityActive, updateFacility } from "@/lib/assets";
import { hasPermission } from "@/lib/role-permissions";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowManageFacilities = user.role === "admin" || (await hasPermission(user.role, "facilities.manage"));
  if (!allowManageFacilities) redirect("/");
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
  await requireAdmin();
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
    });
    REVALIDATE();
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }
  return null;
}

export async function updateFacilityAction(_prev: string | null, fd: FormData): Promise<string | null> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id) return "ไม่พบ ID หน่วยงาน";
  const name = str(fd, "name");
  if (!name) return "กรุณากรอกชื่อหน่วยงาน";
  try {
    await updateFacility(id, {
      name,
      typecode: optStr(fd, "typecode"),
      districtName: optStr(fd, "districtName"),
      tambon: optStr(fd, "tambon"),
      lat: optFloat(fd, "lat"),
      lon: optFloat(fd, "lon"),
    });
    REVALIDATE();
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }
  return null;
}

export async function toggleFacilityActiveAction(id: number, active: boolean): Promise<void> {
  await requireAdmin();
  await toggleFacilityActive(id, active);
  REVALIDATE();
}
