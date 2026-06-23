"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { setBooleanSetting } from "@/lib/app-settings";

const THAI_D_ENABLED_KEY = "auth.thaid.enabled";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function updateThaiDLoginToggleAction(formData: FormData) {
  await requireAdmin();

  const shouldEnable = String(formData.get("enabled") ?? "false") === "true";
  await setBooleanSetting(THAI_D_ENABLED_KEY, shouldEnable);

  revalidatePath("/admin/settings/auth");
  revalidatePath("/login");

  const notice = shouldEnable
    ? "เปิดใช้งาน ThaiD login แล้ว"
    : "ปิดใช้งาน ThaiD login แล้ว";
  redirect(`/admin/settings/auth?notice=${encodeURIComponent(notice)}`);
}
