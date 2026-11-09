import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
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
      <div className="relative isolate w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
        <PhotoBackdrop image="it-storage" opacity="opacity-[0.11]" fade="bottom" />
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          <AppIcon name="wrench" className="h-8 w-8" />
        </span>

        <h1 className="mt-5 text-2xl font-semibold text-[var(--foreground)]">ปิดปรับปรุงระบบชั่วคราว</h1>

        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{state.message}</p>

        {state.expectedBack && (
          <p className="mt-4 rounded-xl bg-[var(--neutral-bg)] px-4 py-3 text-sm font-medium text-[var(--neutral-text)]">
            คาดว่าจะกลับมาใช้งานได้: {state.expectedBack}
          </p>
        )}

        {state.startedAt && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            เริ่มปิดปรับปรุงเมื่อ {formatThaiDateTime(state.startedAt)}
            
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {isAdmin ? (
            <>
              <Link href="/dashboard" className="primary-action">
                <AppIcon name="dashboard" className="h-4 w-4" /> เข้าใช้งานระบบ (ผู้ดูแลระบบ)
              </Link>
              <Link href="/admin/settings/maintenance" className="secondary-action">
                <AppIcon name="settings" className="h-4 w-4" /> จัดการสถานะปิดปรับปรุง
              </Link>
            </>
          ) : (
            <Link href="/login" className="secondary-action">
              <AppIcon name="key" className="h-4 w-4" /> เข้าสู่ระบบสำหรับผู้ดูแลระบบ
            </Link>
          )}
        </div>

        <p className="mt-6 text-xs text-[var(--neutral-text)]">
          ATACS · สำนักงานสาธารณสุขจังหวัดสตูล — หากมีข้อสงสัยหรือต้องใช้งานเร่งด่วน กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
        </p>
      </div>
    </main>
  );
}
