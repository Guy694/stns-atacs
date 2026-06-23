import Link from "next/link";
import { redirect } from "next/navigation";

import { updateMenuVisibilityAction } from "@/app/(main)/admin/settings/menus/actions";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getMenuVisibility } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { APP_MENU_GROUPS, APP_MENU_ITEMS } from "@/lib/menu";
import { hasPermission } from "@/lib/role-permissions";

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
  const canManage = user.role === "admin" || (await hasPermission(user.role, "permissions.manage"));
  if (!canManage) redirect("/dashboard");

  const [params, menuVisibility] = await Promise.all([searchParams, getMenuVisibility()]);
  const notice = readQueryValue(params.notice);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · Navigation</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ตั้งค่าการแสดงเมนู</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          เปิดหรือปิดเมนูหลักของระบบ โดยยังคงตรวจสิทธิ์ผู้ใช้จาก Permission Matrix เหมือนเดิม
        </p>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <form action={updateMenuVisibilityAction} className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-black/8 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">เมนูทั้งหมด</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">หากปิดเมนู จะซ่อนจาก sidebar แต่ URL และ Permission Matrix ยังทำงานตามสิทธิ์เดิม</p>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="border-b border-black/8 bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">เมนู</th>
                <th className="px-5 py-3 font-medium">กลุ่ม</th>
                <th className="px-5 py-3 font-medium">สิทธิ์ที่เกี่ยวข้อง</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 text-right font-medium">เปิดใช้งาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6 bg-white/70">
              {APP_MENU_ITEMS.map((item) => {
                const group = APP_MENU_GROUPS.find((entry) => entry.key === item.group);
                const enabled = menuVisibility[item.key];

                return (
                  <tr key={item.key} className="align-middle hover:bg-[var(--primary-soft)]/30">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="rounded-xl bg-[var(--primary-soft)] p-2 text-[var(--primary-text)]">
                          <AppIcon name={item.icon} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
                          <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
                          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{item.href}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--muted)]">{group?.label ?? item.group}</td>
                    <td className="px-5 py-4">
                      {item.permissionKey ? (
                        <code className="rounded-lg bg-stone-100 px-2 py-1 text-xs text-[var(--foreground)]">{item.permissionKey}</code>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">ไม่มี</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={enabled ? "success" : "neutral"}>
                        {enabled ? "แสดงในเมนู" : "ซ่อนจากเมนู"}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <label className="inline-flex cursor-pointer items-center justify-end gap-2">
                        <span className="sr-only">เปิดใช้งานเมนู {item.label}</span>
                        <input
                          type="checkbox"
                          name={`menu:${item.key}`}
                          defaultChecked={enabled}
                          className="h-5 w-5 rounded border-black/20 text-[var(--accent)] accent-[var(--accent)]"
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>

      <div>
        <Link href="/admin/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          ← กลับหน้าตั้งค่าระบบ
        </Link>
      </div>
    </div>
  );
}
