"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLogSafe } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { currentSessionHash, deleteSession, deleteUserSessions, getSessionOwner } from "@/lib/session-admin";
import { notifyTelegramSafe } from "@/lib/telegram";

const back = (key: "sessnotice" | "sesserror", message: string) => `/admin/security/?${key}=${encodeURIComponent(message)}#sessions`;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

async function logRevoke(actor: { id: number; fullName: string }, summary: string, target: string) {
  await Promise.all([
    writeAuditLogSafe({ userId: actor.id, userName: actor.fullName, action: "delete", entity: "auth_sessions", summary }),
    recordSecurityEvent({ eventType: "session_revoked", ipAddress: readRequestIp(await headers()), identity: actor.fullName, path: "/admin/security", detail: summary, skipBurstAlert: true }),
    notifyTelegramSafe({ category: "security", title: "ผู้ดูแลระบบบังคับออกจากระบบ", throttle: false, details: { ผู้ดำเนินการ: actor.fullName, ผู้ใช้: target, รายละเอียด: summary } }),
  ]);
}

/** Admin: end one session (the user is signed out on that device at their next click). */
export async function revokeSessionAction(formData: FormData) {
  const actor = await requireAdmin();
  const sessionId = Number(formData.get("sessionId"));
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) redirect(back("sesserror", "ไม่พบเซสชัน"));
  const owner = await getSessionOwner(sessionId);
  if (!owner) redirect(back("sessnotice", "เซสชันนี้สิ้นสุดไปแล้ว"));
  if (owner.tokenHash === (await currentSessionHash())) redirect(back("sesserror", "นี่คือเซสชันที่คุณใช้อยู่ — ใช้ปุ่มออกจากระบบแทน"));

  await deleteSession(sessionId);
  await logRevoke(actor, `บังคับออกจากระบบ 1 เครื่องของ ${owner.userName}`, owner.userName);
  revalidatePath("/admin/security");
  redirect(back("sessnotice", `ออกจากระบบเครื่องนั้นของ ${owner.userName} แล้ว`));
}

/** Admin: end every session of a user (keeps the admin's own current session if it is theirs). */
export async function revokeUserSessionsAction(formData: FormData) {
  const actor = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const userName = String(formData.get("userName") ?? "").slice(0, 120) || `ผู้ใช้ #${userId}`;
  if (!Number.isSafeInteger(userId) || userId <= 0) redirect(back("sesserror", "ไม่พบผู้ใช้"));

  const keep = userId === actor.id ? await currentSessionHash() : null;
  const count = await deleteUserSessions(userId, keep);
  await logRevoke(actor, `บังคับออกจากระบบทุกเครื่องของ ${userName} (${count} เซสชัน)`, userName);
  revalidatePath("/admin/security");
  redirect(back("sessnotice", `ออกจากระบบทุกเครื่องของ ${userName} แล้ว (${count} เซสชัน)`));
}

/** Any signed-in user: sign out every other device (profile page). */
export async function revokeMyOtherSessionsAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const count = await deleteUserSessions(user.id, await currentSessionHash());
  await recordSecurityEvent({
    eventType: "session_revoked",
    ipAddress: readRequestIp(await headers()),
    identity: user.fullName,
    path: "/profile",
    detail: `ผู้ใช้ออกจากระบบเครื่องอื่นทั้งหมดเอง (${count} เซสชัน)`,
    skipBurstAlert: true,
  });
  revalidatePath("/profile");
  redirect(`/profile/?notice=${encodeURIComponent(`ออกจากระบบเครื่องอื่นแล้ว ${count} เครื่อง`)}#my-sessions`);
}
