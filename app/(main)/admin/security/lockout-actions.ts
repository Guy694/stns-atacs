"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLogSafe } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { LOGIN_IP_UNLOCK_EVENT, LOGIN_UNLOCK_EVENT } from "@/lib/login-lockout";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";

const back = (key: "locknotice" | "lockerror", message: string) => `/admin/security/?${key}=${encodeURIComponent(message)}#lockouts`;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/** N3: ปลดล็อกบัญชีก่อนครบเวลา — ตัวนับความล้มเหลวของบัญชีนี้เริ่มนับใหม่ */
export async function unlockAccountAction(formData: FormData) {
  const actor = await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().slice(0, 255);
  if (!username) redirect(back("lockerror", "ไม่พบบัญชี"));
  const summary = `ปลดล็อกบัญชี ${username} (ใส่รหัสผ่านผิดหลายครั้ง)`;
  await recordSecurityEvent({
    eventType: LOGIN_UNLOCK_EVENT,
    ipAddress: readRequestIp(await headers()),
    identity: username,
    path: "/admin/security",
    detail: `${summary} โดย ${actor.fullName}`,
    skipBurstAlert: true,
  });
  await writeAuditLogSafe({ userId: actor.id, userName: actor.fullName, action: "update", entity: "security_events", summary });
  await notifyTelegramSafe({ category: "security", title: "🔓 ผู้ดูแลปลดล็อกบัญชี", throttle: false, details: { บัญชี: username, ผู้ดำเนินการ: actor.fullName } });
  revalidatePath("/admin/security");
  redirect(back("locknotice", `ปลดล็อกบัญชี ${username} แล้ว`));
}

/** N3: ปลดล็อก IP (เช่น สำนักงานที่ใช้ IP ร่วมกันแล้วมีคนพิมพ์ผิดหลายคน) */
export async function unlockIpAction(formData: FormData) {
  const actor = await requireAdmin();
  const ip = String(formData.get("ip") ?? "").trim();
  if (!/^[0-9a-fA-F:.]{2,45}$/.test(ip)) redirect(back("lockerror", "IP ไม่ถูกต้อง"));
  const summary = `ปลดล็อก IP ${ip} (ใส่รหัสผ่านผิดหลายครั้ง)`;
  await recordSecurityEvent({
    eventType: LOGIN_IP_UNLOCK_EVENT,
    ipAddress: ip,
    identity: actor.fullName,
    path: "/admin/security",
    detail: `${summary} โดย ${actor.fullName}`,
    skipBurstAlert: true,
  });
  await writeAuditLogSafe({ userId: actor.id, userName: actor.fullName, action: "update", entity: "security_events", summary });
  await notifyTelegramSafe({ category: "security", title: "🔓 ผู้ดูแลปลดล็อก IP", throttle: false, details: { IP: ip, ผู้ดำเนินการ: actor.fullName } });
  revalidatePath("/admin/security");
  redirect(back("locknotice", `ปลดล็อก IP ${ip} แล้ว`));
}
