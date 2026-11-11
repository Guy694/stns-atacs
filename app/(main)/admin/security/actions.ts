"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLogSafe } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getPasswordLoginState, setPasswordLoginMode, userHasExternalLogin } from "@/lib/password-login";
import { normalizePasswordLoginMode, PASSWORD_LOGIN_MODES, validatePasswordLoginModeChange } from "@/lib/password-login-policy";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";

const back = (key: "notice" | "pwerror", message: string) => `/admin/security/?${key}=${encodeURIComponent(message)}#login-methods`;

export async function updatePasswordLoginModeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const next = normalizePasswordLoginMode(String(formData.get("mode") ?? ""));
  const state = await getPasswordLoginState();
  if (next === state.stored) redirect(back("notice", "ไม่มีการเปลี่ยนแปลง"));

  const error = validatePasswordLoginModeChange(next, {
    altLoginAvailable: state.altLoginAvailable,
    actorHasExternalLogin: await userHasExternalLogin(user.id).catch(() => false),
  });
  if (error) redirect(back("pwerror", error));

  await setPasswordLoginMode(next);

  const from = PASSWORD_LOGIN_MODES.find((mode) => mode.key === state.stored)?.label ?? state.stored;
  const to = PASSWORD_LOGIN_MODES.find((mode) => mode.key === next)?.label ?? next;
  const summary = `Username/Password: ${from} → ${to}`;
  await Promise.all([
    writeAuditLogSafe({ userId: user.id, userName: user.fullName, action: "update", entity: "auth_settings", summary }),
    recordSecurityEvent({
      eventType: "auth_setting_changed",
      ipAddress: readRequestIp(await headers()),
      identity: user.fullName,
      path: "/admin/security",
      detail: summary,
    }),
    notifyTelegramSafe({
      category: "security",
      title: "เปลี่ยนการเข้าสู่ระบบด้วย Username/Password",
      throttle: false,
      details: { ผู้เปลี่ยน: user.fullName, จาก: from, เป็น: to },
    }),
  ]);

  revalidatePath("/admin/security");
  revalidatePath("/login");
  redirect(back("notice", `บันทึกแล้ว: ${to}`));
}
