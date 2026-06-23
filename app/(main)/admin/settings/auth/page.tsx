import Link from "next/link";
import { redirect } from "next/navigation";

import { updateThaiDLoginToggleAction } from "@/app/(main)/admin/settings/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getThaiIdStatus } from "@/lib/thaiid";

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
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · Authentication</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ตั้งค่าการเข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">จัดการช่องทางเข้าสู่ระบบสำหรับผู้ใช้งานทั้งหมด</p>
      </div>

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
            <p className="mt-2 text-xs text-[var(--muted)]">
              สถานะปัจจุบัน: {thaiIdStatus.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </p>
            {thaiIdStatus.reason ? (
              <p className="mt-1 text-xs text-amber-700">หมายเหตุ: {thaiIdStatus.reason}</p>
            ) : null}
          </div>

          <form action={updateThaiDLoginToggleAction} className="flex items-center gap-2">
            <input type="hidden" name="enabled" value={thaiIdStatus.enabled ? "false" : "true"} />
            <button
              type="submit"
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
                thaiIdStatus.enabled ? "bg-rose-600" : "bg-emerald-600"
              }`}
            >
              {thaiIdStatus.enabled ? "ปิด ThaiD Login" : "เปิด ThaiD Login"}
            </button>
          </form>
        </div>
      </section>

      <div>
        <Link href="/admin/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          ← กลับหน้าตั้งค่าระบบ
        </Link>
      </div>
    </div>
  );
}
