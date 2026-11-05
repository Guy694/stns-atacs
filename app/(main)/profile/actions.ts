"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit";
import { redirect } from "next/navigation";

import type { RowDataPacket } from "mysql2/promise";

import { getCurrentUser, hashPassword, splitDisplayName, verifyPassword, revokeUserSessions } from "@/lib/auth";
import { isDuplicateEntryError, normalizeProfileEmail } from "@/lib/input-guards";
import { executeStatement, selectRows } from "@/lib/mysql";

async function getUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function updateProfileAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getUser();

  const fullName = (fd.get("fullName") as string | null)?.trim() ?? "";
  const { email, error: emailError } = normalizeProfileEmail(fd.get("email"));
  const { firstName, lastName } = splitDisplayName(fullName);

  if (!fullName) return "กรุณากรอกชื่อ-นามสกุล";
  if (!firstName || !lastName) return "กรุณากรอกชื่อและนามสกุลให้ครบ";
  if (emailError) return emailError;

  // B6: the e-mail is how a Google identity is matched (lib/google-link.ts), so an address that
  // already belongs to another account can never be taken over from the profile page.
  if (email) {
    const taken = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? LIMIT 1",
      [email, user.id]
    );
    if (taken.length > 0) return "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว";
  }

  try {
    await executeStatement("UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?", [firstName, lastName, email, user.id]);
  } catch (error) {
    if (isDuplicateEntryError(error)) return "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว";
    throw error;
  }
  revalidatePath("/profile");
  return null;
}

/**
 * SEC-21: เดิมเจ้าหน้าที่ที่ยังไม่มีหน่วยงาน เลือกหน่วยงานใดก็ได้ด้วยตัวเอง
 * ซึ่งเท่ากับเลือกขอบเขตข้อมูลที่ตัวเองเห็นได้ ทุกเส้นทางการสมัคร (ThaiD / Google / Username)
 * บันทึกหน่วยงานไว้ตั้งแต่ตอนลงทะเบียนอยู่แล้ว การแก้ไขภายหลังจึงเป็นงานของผู้ดูแลระบบ
 * คงฟังก์ชันไว้เป็นด่านกันการเรียกตรง และบันทึก audit log ทุกครั้งที่มีการพยายาม
 */
export async function updateFacilityAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await getUser();
  const requested = (fd.get("facilityId") as string | null)?.trim() ?? "";

  await writeAuditLog({
    userId: user.id,
    userName: user.fullName,
    action: "update",
    entity: "users",
    entityId: Number(user.id),
    summary: `ปฏิเสธคำขอเปลี่ยนหน่วยงานของตนเอง${requested ? ` เป็นหน่วยงาน #${requested}` : ""} (ต้องให้ผู้ดูแลระบบกำหนด)`,
  });

  return "หน่วยงานที่สังกัดกำหนดโดยผู้ดูแลระบบเท่านั้น กรุณาติดต่อผู้ดูแลระบบหากข้อมูลไม่ถูกต้อง";
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
  // SEC-09: เครื่องอื่นที่ยังค้างเซสชันเดิมอยู่ต้องหลุดทันที (เครื่องที่กำลังใช้อยู่ไม่หลุด)
  await revokeUserSessions(Number(user.id), { keepCurrent: true });
  return null;
}
