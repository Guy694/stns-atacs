import Link from "next/link";
import { redirect } from "next/navigation";

import { updateThaiDLoginToggleAction } from "@/app/(main)/admin/settings/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getThaiIdStatus } from "@/lib/thaiid";
import { SubmitButton } from "@/app/_components/ui/submit-button";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { AppIcon } from "@/app/_components/ui/icon";
import { PageHero, SettingsBreadcrumb } from "@/app/(main)/admin/_components/page-hero";

type AuthSettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthSettingsPage({ searchParams }: AuthSettingsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const notice = readQueryValue(params.notice);
  const thaiIdStatus = await getThaiIdStatus();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <SettingsBreadcrumb current="การเข้าสู่ระบบ" />
      <PageHero
        icon="shield"
        image="it-storage"
        title="ตั้งค่าการเข้าสู่ระบบ"
        description="จัดการช่องทางเข้าสู่ระบบสำหรับผู้ใช้งานทั้งหมด"
      />

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">ThaiD Login</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              สลับเปิด/ปิดการเข้าสู่ระบบด้วย ThaiD สำหรับหน้า Login และ OAuth callback
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
              สถานะปัจจุบัน:
              <StatusBadge tone={thaiIdStatus.enabled ? "success" : "neutral"}>{thaiIdStatus.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</StatusBadge>
            </p>
            {thaiIdStatus.reason ? (
              <p className="mt-1 text-xs text-amber-700">หมายเหตุ: {thaiIdStatus.reason}</p>
            ) : null}
          </div>

          <form action={updateThaiDLoginToggleAction} className="flex items-center gap-2">
            <input type="hidden" name="enabled" value={thaiIdStatus.enabled ? "false" : "true"} />
            <SubmitButton pendingText="กำลังบันทึก…" className={thaiIdStatus.enabled ? "danger-action" : "primary-action"}>
              <AppIcon name={thaiIdStatus.enabled ? "power-off" : "power-on"} size={16} />
              {thaiIdStatus.enabled ? "ปิด ThaiD Login" : "เปิด ThaiD Login"}
            </SubmitButton>
          </form>
        </div>
      </section>

      <section className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-semibold">Username / Password</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">เปิดสำหรับทุกคน · เฉพาะผู้ดูแลระบบ · หรือปิดทั้งหมด จัดการได้ที่เมนูความปลอดภัยระบบ</p>
        </div>
        <Link href="/admin/security/#login-methods" className="secondary-action gap-2">
          <AppIcon name="shield" size={16} /> ไปที่ความปลอดภัยระบบ
        </Link>
      </section>

      <div>
        <Link href="/admin/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary-text)] hover:underline">
          <AppIcon name="arrow-left" size={15} />
          กลับหน้าตั้งค่าระบบ
        </Link>
      </div>
    </div>
  );
}
