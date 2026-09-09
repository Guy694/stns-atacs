import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listFacilitiesAdmin } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { FacilitiesClient } from "./_components/facilities-client";

export const dynamic = "force-dynamic";

export default async function AdminFacilitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowManageFacilities = user.role === "admin" || (await hasPermission(user.role, "facilities.manage"));
  if (!allowManageFacilities) redirect("/dashboard");

  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");
  const facilities = await listFacilitiesAdmin(facilityScopeId ? { facilityId: facilityScopeId } : undefined);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/admin/settings" className="hover:underline">ตั้งค่าระบบ</Link>
        <span>›</span>
        <span>จัดการหน่วยงาน</span>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · ตั้งค่าระบบ</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">จัดการหน่วยงาน</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">เพิ่ม/แก้ไข/ปิดใช้งาน หน่วยบริการสาธารณสุขในจังหวัดสตูล</p>
      </div>

      <FacilitiesClient facilities={facilities} canCreate={user.role === "admin"} canToggleActive={user.role === "admin"} />
    </div>
  );
}
