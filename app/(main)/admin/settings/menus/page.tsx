import Link from "next/link";
import { redirect } from "next/navigation";

import { updateMenuVisibilityAction } from "@/app/(main)/admin/settings/menus/actions";
import { MenuVisibilityTable, type MenuVisibilityRow } from "./_components/menu-visibility-table";
import { getMenuVisibility } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { APP_MENU_GROUPS, APP_MENU_ITEMS } from "@/lib/menu";
import { AppIcon } from "@/app/_components/ui/icon";
import { PageHero, SettingsBreadcrumb } from "@/app/(main)/admin/_components/page-hero";

type MenuSettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};


function readQueryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

export default async function MenuSettingsPage({ searchParams }: MenuSettingsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [params, menuVisibility] = await Promise.all([searchParams, getMenuVisibility()]);
  const notice = readQueryValue(params.notice);

  const rows: MenuVisibilityRow[] = APP_MENU_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    href: item.href,
    icon: item.icon,
    groupLabel: APP_MENU_GROUPS.find((entry) => entry.key === item.group)?.label ?? item.group,
    groupRank: APP_MENU_GROUPS.findIndex((entry) => entry.key === item.group),
    permissionKey: item.permissionKey ?? null,
    enabled: Boolean(menuVisibility[item.key]),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <SettingsBreadcrumb current="การแสดงเมนู" />
      <PageHero
        icon="menu"
        image="office-desk"
        title="ตั้งค่าการแสดงเมนู"
        description="เปิดหรือปิดเมนูหลักของระบบ โดยยังคงตรวจสิทธิ์ผู้ใช้ตามตารางสิทธิ์เหมือนเดิม"
      />

      {notice ? (
        <div className="rounded-xl border border-[var(--state-success-border)] bg-[var(--state-success-bg)] px-4 py-3 text-sm text-[var(--state-success-fg)]">
          {notice}
        </div>
      ) : null}

      <form action={updateMenuVisibilityAction} className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-black/8 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">เมนูทั้งหมด</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">หากปิดเมนู จะซ่อนจากแถบเมนู แต่ลิงก์และตารางสิทธิ์ยังทำงานตามสิทธิ์เดิม</p>
            </div>
            <button
              type="submit"
              className="primary-action"
            >
              <AppIcon name="check" size={16} />
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <MenuVisibilityTable rows={rows} />
        </div>
      </form>

      <div>
        <Link href="/admin/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary-text)] hover:underline">
          <AppIcon name="arrow-left" size={15} />
          กลับหน้าตั้งค่าระบบ
        </Link>
      </div>
    </div>
  );
}
