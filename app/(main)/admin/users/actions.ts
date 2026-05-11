"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, hashPassword } from "@/lib/auth";
import { executeStatement, selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

type UserRow = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  email: string | null;
  username: string | null;
  role: "admin" | "officer";
  is_active: number;
  last_login_at: Date | string | null;
};

export async function listUsersAction() {
  await requireAdmin();
  return selectRows<UserRow>(
    `SELECT id, thaid_cid, full_name, email, username, role, is_active, last_login_at
     FROM users ORDER BY role DESC, full_name ASC`
  );
}

export async function createUserAction(_prev: string | null, fd: FormData): Promise<string | null> {
  await requireAdmin();

  const fullName = (fd.get("fullName") as string | null)?.trim() ?? "";
  const email = (fd.get("email") as string | null)?.trim() || null;
  const username = (fd.get("username") as string | null)?.trim() || null;
  const password = (fd.get("password") as string | null)?.trim() || null;
  const thaidCid = (fd.get("thaidCid") as string | null)?.trim() || null;
  const role = (fd.get("role") as string | null)?.trim() ?? "officer";

  if (!fullName) return "กรุณากรอกชื่อ-นามสกุล";
  if (!thaidCid && !username) return "ต้องมีอย่างน้อย ThaiD หรือ username";
  if (username && !password) return "กรุณากรอกรหัสผ่านสำหรับ username";
  if (!["admin", "officer"].includes(role)) return "Role ไม่ถูกต้อง";

  let passwordHash: string | null = null;
  if (username && password) {
    if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    passwordHash = hashPassword(password);
  }

  try {
    await executeStatement(
      `INSERT INTO users (thaid_cid, full_name, email, username, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [thaidCid, fullName, email, username, passwordHash, role]
    );
    revalidatePath("/admin/users");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate") && msg.includes("username")) return "username นี้ถูกใช้งานแล้ว";
    if (msg.includes("Duplicate") && msg.includes("thaid")) return "ThaiD นี้มีในระบบแล้ว";
    if (msg.includes("Duplicate") && msg.includes("email")) return "Email นี้ถูกใช้งานแล้ว";
    return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function toggleUserActiveAction(userId: number, currentActive: boolean): Promise<void> {
  await requireAdmin();
  await executeStatement("UPDATE users SET is_active = ? WHERE id = ?", [currentActive ? 0 : 1, userId]);
  revalidatePath("/admin/users");
}

export async function updateUserRoleAction(userId: number, newRole: "admin" | "officer"): Promise<void> {
  await requireAdmin();
  await executeStatement("UPDATE users SET role = ? WHERE id = ?", [newRole, userId]);
  revalidatePath("/admin/users");
}

export async function resetUserPasswordAction(_prev: string | null, fd: FormData): Promise<string | null> {
  await requireAdmin();

  const userId = Number(fd.get("userId"));
  const newPassword = (fd.get("newPassword") as string | null)?.trim() ?? "";

  if (!userId || isNaN(userId)) return "User ID ไม่ถูกต้อง";
  if (newPassword.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";

  const hash = hashPassword(newPassword);
  await executeStatement("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
  revalidatePath("/admin/users");
  return null;
}
