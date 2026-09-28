import Link from "next/link";

import { getMaintenanceState } from "@/lib/maintenance";

/**
 * เตือนผู้ดูแลระบบว่าตอนนี้ระบบปิดปรับปรุงอยู่ ผู้ใช้ทั่วไปเข้าไม่ได้
 * กันการลืมปิดโหมดนี้ทิ้งไว้หลังทำงานเสร็จ
 */
export async function MaintenanceBanner({ canManage }: { canManage: boolean }) {
  if (!canManage) return null;

  const state = await getMaintenanceState();
  if (!state.enabled) return null;

  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">
        ขณะนี้ระบบอยู่ในโหมดปิดปรับปรุง — ผู้ใช้ทั่วไปเข้าใช้งานไม่ได้ เห็นเฉพาะหน้าแจ้งสถานะ
      </p>
      <Link href="/admin/settings/maintenance" className="shrink-0 font-semibold underline underline-offset-4">
        จัดการสถานะ
      </Link>
    </div>
  );
}
