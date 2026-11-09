import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import {
  listFacilityWorkGroupsForFacilities,
  listManageableWorkGroupFacilitiesForUser,
} from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import { WorkGroupsClient } from "./_components/work-groups-client";
import { PageHero, SettingsBreadcrumb } from "@/app/(main)/admin/_components/page-hero";

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
      <SettingsBreadcrumb current="จัดการกลุ่มงาน" />
      <PageHero
        icon="users"
        image="meeting-room"
        title="จัดการกลุ่มงาน"
        description="สร้างกลุ่มงานของ สสจ, สสอ และโรงพยาบาล เพื่อใช้ระบุตอนติดตั้ง ATACS Agent"
        actions={
          <StatusBadge tone={facilities.length > 0 ? "success" : "warning"}>
            {facilities.length > 0 ? "พร้อมสร้างกลุ่มงาน" : "ไม่มีหน่วยงานที่ต้องระบุกลุ่มงาน"}
          </StatusBadge>
        }
      />

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
