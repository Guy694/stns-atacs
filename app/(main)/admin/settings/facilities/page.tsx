import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listFacilitiesAdmin } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { FacilitiesClient } from "./_components/facilities-client";
import { PageHero, SettingsBreadcrumb } from "@/app/(main)/admin/_components/page-hero";

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
      <SettingsBreadcrumb current="จัดการหน่วยงาน" />
      <PageHero
        icon="building"
        image="office-desk"
        title="จัดการหน่วยงาน"
        description="เพิ่ม/แก้ไข/ปิดใช้งาน หน่วยบริการสาธารณสุขในจังหวัดสตูล"
      />

      <FacilitiesClient facilities={facilities} canCreate={user.role === "admin"} canToggleActive={user.role === "admin"} />
    </div>
  );
}
