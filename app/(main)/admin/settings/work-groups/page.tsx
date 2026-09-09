import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import {
  listFacilityWorkGroupsForFacilities,
  listManageableWorkGroupFacilitiesForUser,
} from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import { WorkGroupsClient } from "./_components/work-groups-client";

export const dynamic = "force-dynamic";

export default async function WorkGroupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canManageWorkGroups = user.role === "admin" || (await hasPermission(user.role, "work-groups.manage"));
  if (!canManageWorkGroups) redirect("/dashboard");

  const facilities = await listManageableWorkGroupFacilitiesForUser({
    role: user.role,
    facilityId: user.facilityId,
  });
  if (user.role !== "admin" && facilities.length === 0) redirect("/dashboard");

  let workGroups: Awaited<ReturnType<typeof listFacilityWorkGroupsForFacilities>> = [];
  let dbError: string | null = null;

  try {
    workGroups = await listFacilityWorkGroupsForFacilities(
      facilities.map((facility) => facility.id),
      true
    );
  } catch {
    dbError = "ยังไม่พบตาราง facility_work_groups กรุณารัน database/add_facility_work_groups.sql ก่อน";
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/admin/settings" className="hover:underline">ตั้งค่าระบบ</Link>
        <span>›</span>
        <span>จัดการกลุ่มงาน</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS Agent</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">จัดการกลุ่มงาน</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            สร้างกลุ่มงานของ สสจ, สสอ และโรงพยาบาล เพื่อใช้ระบุตอนติดตั้ง ATACS Agent
          </p>
        </div>
        <StatusBadge tone={facilities.length > 0 ? "success" : "warning"}>
          {facilities.length > 0 ? "พร้อมสร้างกลุ่มงาน" : "ไม่มีหน่วยงานที่ต้องระบุกลุ่มงาน"}
        </StatusBadge>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {dbError}
        </div>
      ) : (
        <WorkGroupsClient facilities={facilities} workGroups={workGroups} />
      )}
    </div>
  );
}
