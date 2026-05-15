"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { RowDataPacket } from "mysql2/promise";

import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { executeStatement, selectRows } from "@/lib/mysql";

async function getUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function updateProfileAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getUser();

  const fullName = (fd.get("fullName") as string | null)?.trim() ?? "";
  const email = (fd.get("email") as string | null)?.trim() || null;

  if (!fullName) return "กรุณากรอกชื่อ-นามสกุล";

  await executeStatement("UPDATE users SET full_name = ?, email = ? WHERE id = ?", [fullName, email, user.id]);
  revalidatePath("/profile");
  return null;
}

export async function updateFacilityAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getUser();
  if (user.role !== "officer") return "เฉพาะ officer เท่านั้นที่สามารถเลือกหน่วยงานได้";

  const raw = (fd.get("facilityId") as string | null)?.trim() ?? "";
  const facilityId = raw ? parseInt(raw, 10) : null;
  if (!facilityId || isNaN(facilityId)) return "กรุณาเลือกหน่วยงาน";

  try {
    await executeStatement("UPDATE users SET facility_id = ? WHERE id = ?", [facilityId, user.id]);
  } catch {
    return "ไม่สามารถบันทึกได้ — กรุณาตรวจสอบว่ารัน migration add_facility_approval.sql แล้ว";
  }

  revalidatePath("/profile");
  revalidatePath("/agent-download");
  return null;
}

export async function changePasswordAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getUser();

  const currentPassword = (fd.get("currentPassword") as string | null) ?? "";
  const newPassword = (fd.get("newPassword") as string | null)?.trim() ?? "";
  const confirmPassword = (fd.get("confirmPassword") as string | null)?.trim() ?? "";

  if (!currentPassword) return "กรุณากรอกรหัสผ่านปัจจุบัน";
  if (newPassword.length < 8) return "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร";
  if (newPassword !== confirmPassword) return "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน";

  type PwRow = RowDataPacket & { password_hash: string | null };
  const rows = await selectRows<PwRow>("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [user.id]);
  const storedHash = rows[0]?.password_hash;

  if (!storedHash) return "บัญชีนี้ไม่มีรหัสผ่าน (ใช้ ThaiD เท่านั้น) กรุณาติดต่อผู้ดูแลระบบ";

  const valid = verifyPassword(currentPassword, storedHash);
  if (!valid) return "รหัสผ่านปัจจุบันไม่ถูกต้อง";

  const newHash = hashPassword(newPassword);
  await executeStatement("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
  return null;
}
