"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { createDeviceType, toggleDeviceTypeActive, updateDeviceType } from "@/lib/device-types";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
}

const REVALIDATE = () => revalidatePath("/admin/settings/device-types");

export async function createDeviceTypeAction(_prev: string | null, fd: FormData): Promise<string | null> {
  await requireAdmin();
  const name = (fd.get("name") as string | null)?.trim() ?? "";
  const category = fd.get("category") as "Hardware" | "Software" | null;
  if (!name) return "กรุณากรอกชื่อประเภท";
  if (category !== "Hardware" && category !== "Software") return "กรุณาเลือกหมวดหมู่";
  try {
    await createDeviceType(name, category);
    REVALIDATE();
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }
  return null;
}

export async function updateDeviceTypeAction(_prev: string | null, fd: FormData): Promise<string | null> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id) return "ไม่พบ ID";
  const name = (fd.get("name") as string | null)?.trim() ?? "";
  const category = fd.get("category") as "Hardware" | "Software" | null;
  if (!name) return "กรุณากรอกชื่อประเภท";
  if (category !== "Hardware" && category !== "Software") return "กรุณาเลือกหมวดหมู่";
  try {
    await updateDeviceType(id, name, category);
    REVALIDATE();
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }
  return null;
}

export async function toggleDeviceTypeActiveAction(id: number, active: boolean): Promise<void> {
  await requireAdmin();
  await toggleDeviceTypeActive(id, active);
  REVALIDATE();
}
