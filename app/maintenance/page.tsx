import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDateTime } from "@/lib/date-format";
import { canBypassMaintenance, getMaintenanceState } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * หน้าสถานะ "ปิดปรับปรุงระบบ" — เปิดได้โดยไม่ต้องเข้าสู่ระบบ
 * ถ้าไม่ได้อยู่ในโหมดปิดปรับปรุง จะพากลับหน้าแรก เพื่อไม่ให้ใครค้างอยู่หน้านี้
 */
export default async function MaintenancePage() {
  const state = await getMaintenanceState();
  if (!state.enabled) redirect("/");

  const user = await getCurrentUser().catch(() => null);
  const isAdmin = canBypassMaintenance(user);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          <AppIcon name="settings" className="h-8 w-8" />
        </span>

        <p className="mt-5 text-xs font-semibold tracking-[0.16em] text-[var(--accent-strong)]">
          ATACS · สำนักงานสาธารณสุขจังหวัดสตูล
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">ปิดปรับปรุงระบบชั่วคราว</h1>

        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{state.message}</p>

        {state.expectedBack && (
          <p className="mt-4 rounded-xl bg-[var(--neutral-bg)] px-4 py-3 text-sm font-medium text-[var(--neutral-text)]">
            คาดว่าจะกลับมาใช้งานได้: {state.expectedBack}
          </p>
        )}

        {state.startedAt && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            เริ่มปิดปรับปรุงเมื่อ {formatThaiDateTime(state.startedAt)}
            {state.startedBy ? ` โดย ${state.startedBy}` : ""}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {isAdmin ? (
            <>
              <Link href="/dashboard" className="filter-button bg-[var(--accent-strong)] text-white">
                เข้าใช้งานระบบ (ผู้ดูแลระบบ)
              </Link>
              <Link href="/admin/settings/maintenance" className="filter-button border border-[var(--line)] text-[var(--primary-text)]">
                จัดการสถานะปิดปรับปรุง
              </Link>
            </>
          ) : (
            <Link href="/login" className="filter-button border border-[var(--line)] text-[var(--primary-text)]">
              เข้าสู่ระบบสำหรับผู้ดูแลระบบ
            </Link>
          )}
        </div>

        <p className="mt-6 text-xs text-[var(--muted)]">
          หากมีข้อสงสัยหรือต้องใช้งานเร่งด่วน กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
        </p>
      </div>
    </main>
  );
}
