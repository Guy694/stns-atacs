import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { InstallCommandPanel } from "@/app/(main)/admin/settings/agent/_components/install-command-panel";
import { getCurrentUser } from "@/lib/auth";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { listFacilityWorkGroups, requiresAgentWorkGroup } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";

import { AgentUninstallCommands } from "./_components/agent-uninstall-commands";
import { getDownloadInstallCommand } from "./actions";

export default async function AgentDownloadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // SEC-03: ต้องมีสิทธิ์ agent.manage (เมนูซ่อนด้วยสิทธิ์นี้อยู่แล้ว)
  if (user.role === "viewer" || !(user.role === "admin" || (await hasPermission(user.role, "agent.manage")))) {
    redirect("/dashboard");
  }

  const facilityScopeId = getFacilityScopeId(user);
  const facilities = facilityScopeId === null ? [] : await listAllFacilitiesForSelect(facilityScopeId ? { facilityId: facilityScopeId } : undefined);
  const workGroups = facilityScopeId === null ? [] : await listFacilityWorkGroups(facilityScopeId || undefined).catch(() => []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <header className="glass-panel relative isolate overflow-hidden rounded-2xl px-5 py-5 sm:px-6">
        <PhotoBackdrop image="it-storage" fade="left" opacity="opacity-[0.12]" />
        <h1 className="section-title text-2xl font-semibold sm:text-3xl">ติดตั้ง ATACS Agent</h1>
        <p className="mt-1.5 max-w-xl text-sm text-[var(--muted)]">
          เลือกหน่วยงานและระบบปฏิบัติการ คัดลอกคำสั่ง แล้วนำไปวางที่เครื่องคอมพิวเตอร์ของหน่วยงาน เครื่องจะรายงานข้อมูลฮาร์ดแวร์เข้าระบบอัตโนมัติ
        </p>
      </header>

      {facilities.length === 0 ? (
        <div className="glass-panel relative isolate overflow-hidden rounded-2xl px-6 py-10 text-center">
          <PhotoBackdrop image="office-desk" fade="bottom" opacity="opacity-[0.08]" />
          <AppIcon name="building" className="mx-auto mb-2 h-8 w-8 text-[var(--muted)]" />
          <p className="font-medium">บัญชีของคุณยังไม่ได้ผูกกับหน่วยงาน</p>
          <p className="mt-1 text-sm text-[var(--muted)]">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยงานที่สังกัดก่อน</p>
        </div>
      ) : (
        <InstallCommandPanel
          facilities={facilities.map((facility) => ({
            id: facility.id,
            name: facility.facility_name,
            typecode: facility.typecode,
            districtName: facility.district_name,
            requiresWorkGroup: requiresAgentWorkGroup(facility.typecode),
          }))}
          workGroups={workGroups.map((group) => ({ id: group.id, facilityId: group.facilityId, workGroupName: group.workGroupName }))}
          getCommand={getDownloadInstallCommand}
        />
      )}

      <section className="glass-panel rounded-2xl px-5 py-4">
        <h2 className="text-base font-semibold">ถอนการติดตั้ง</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">ใช้กับเครื่องที่ต้องการเอา Agent ออกเอง หรือ Agent รุ่นเก่าที่ถอนจากระยะไกลไม่ได้</p>
        <div className="mt-3">
          <AgentUninstallCommands compact />
        </div>
      </section>
    </div>
  );
}
