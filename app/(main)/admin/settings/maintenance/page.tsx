import Link from "next/link";
import { redirect } from "next/navigation";

import { updateMaintenanceModeAction } from "@/app/(main)/admin/settings/maintenance/actions";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDateTime } from "@/lib/date-format";
import { DEFAULT_MAINTENANCE_MESSAGE, MAINTENANCE_MESSAGE_MAX, getMaintenanceState } from "@/lib/maintenance";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function MaintenanceSettingsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const notice = one((await searchParams).notice);
  const state = await getMaintenanceState();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ADMIN · MAINTENANCE</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ปิดปรับปรุงระบบ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          เมื่อเปิดโหมดนี้ ผู้ใช้ทั่วไปจะเห็นหน้าแจ้งปิดปรับปรุงและเข้าสู่ระบบไม่ได้ ส่วนผู้ดูแลระบบยังใช้งานได้ตามปกติ
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      )}

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">สถานะปัจจุบัน</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {state.enabled ? "ผู้ใช้ทั่วไปกำลังเห็นหน้าปิดปรับปรุงอยู่" : "ระบบเปิดให้ใช้งานตามปกติ"}
            </p>
          </div>
          <StatusBadge tone={state.enabled ? "warning" : "success"}>
            {state.enabled ? "ปิดปรับปรุงอยู่" : "เปิดใช้งานปกติ"}
          </StatusBadge>
        </div>

        {state.enabled && state.startedAt && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            เริ่มเมื่อ {formatThaiDateTime(state.startedAt)}
            {state.startedBy ? ` โดย ${state.startedBy}` : ""}
          </p>
        )}
      </section>

      <form action={updateMaintenanceModeAction} className="glass-panel space-y-5 rounded-2xl p-6">
        <input type="hidden" name="enabled" value={state.enabled ? "false" : "true"} />

        <div>
          <label htmlFor="maintenance-message" className="block text-sm font-medium">
            ข้อความที่ผู้ใช้จะเห็น
          </label>
          <textarea
            id="maintenance-message"
            name="message"
            rows={3}
            maxLength={MAINTENANCE_MESSAGE_MAX}
            defaultValue={state.message}
            placeholder={DEFAULT_MAINTENANCE_MESSAGE}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">ไม่เกิน {MAINTENANCE_MESSAGE_MAX} ตัวอักษร · เว้นว่างเพื่อใช้ข้อความมาตรฐาน</p>
        </div>

        <div>
          <label htmlFor="maintenance-expected" className="block text-sm font-medium">
            คาดว่าจะกลับมาใช้งานได้ (ไม่บังคับ)
          </label>
          <input
            id="maintenance-expected"
            name="expectedBack"
            maxLength={MAINTENANCE_MESSAGE_MAX}
            defaultValue={state.expectedBack}
            placeholder="เช่น 18:00 น. วันนี้ หรือ พรุ่งนี้เช้า"
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 ${
              state.enabled ? "bg-emerald-600" : "bg-amber-600"
            }`}
          >
            {state.enabled ? "เปิดระบบให้ใช้งานตามปกติ" : "เปิดโหมดปิดปรับปรุงระบบ"}
          </button>
          <Link href="/maintenance" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ดูหน้าที่ผู้ใช้จะเห็น
          </Link>
        </div>

        {!state.enabled && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            เมื่อกดเปิด ผู้ใช้ที่กำลังใช้งานอยู่จะถูกพาไปหน้าปิดปรับปรุงในคำขอถัดไป และเข้าสู่ระบบใหม่ไม่ได้จนกว่าจะปิดโหมดนี้
            (ข้อความและเวลาที่กรอกไว้จะถูกบันทึกพร้อมกัน)
          </p>
        )}
      </form>

      <div>
        <Link href="/admin/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          ← กลับหน้าตั้งค่าระบบ
        </Link>
      </div>
    </div>
  );
}
