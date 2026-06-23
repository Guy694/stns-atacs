"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMenuVisibility, setMenuVisibility } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { APP_MENU_ITEMS } from "@/lib/menu";
import { hasPermission } from "@/lib/role-permissions";

async function requireMenuManager() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "admin") return user;
  if (await hasPermission(user.role, "permissions.manage")) return user;

  redirect("/");
}

export async function updateMenuVisibilityAction(formData: FormData) {
  const user = await requireMenuManager();
  const current = await getMenuVisibility();
  const nextVisibility = Object.fromEntries(
    APP_MENU_ITEMS.map((item) => [item.key, formData.get(`menu:${item.key}`) === "on"])
  );

  await setMenuVisibility(nextVisibility);

  const changed = APP_MENU_ITEMS.filter((item) => current[item.key] !== nextVisibility[item.key])
    .map((item) => `${item.label}: ${nextVisibility[item.key] ? "เปิด" : "ปิด"}`)
    .join(", ");

  await writeAuditLog({
    userId: user.id,
    userName: user.fullName,
    action: "update",
    entity: "app_settings",
    summary: changed ? `ปรับการแสดงเมนู (${changed})` : "บันทึกการตั้งค่าเมนูโดยไม่มีรายการเปลี่ยนแปลง",
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/menus");

  redirect(`/admin/settings/menus?notice=${encodeURIComponent("บันทึกการตั้งค่าเมนูแล้ว")}`);
}
