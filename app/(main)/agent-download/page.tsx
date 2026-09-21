import { redirect } from "next/navigation";

import { getPrimaryAgentInstallKey } from "@/lib/agent-install-key";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityAgentContext, listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { AgentDownloadPanel } from "./_components/agent-download-panel";

export default async function AgentDownloadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const staticInstallKey = getPrimaryAgentInstallKey();

  let facilityName = "–";
  let requiresWorkGroup = false;
  let workGroups: Awaited<ReturnType<typeof listFacilityWorkGroups>> = [];
  if (user.facilityId) {
    try {
      const facility = await getFacilityAgentContext(user.facilityId);
      if (facility) {
        facilityName = facility.name;
        requiresWorkGroup = facility.requiresWorkGroup;
      }
      workGroups = await listFacilityWorkGroups(user.facilityId);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS AGENT</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ดาวน์โหลด Agent</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ติดตั้ง ATACS Agent บนเครื่องคอมพิวเตอร์ของหน่วยงาน เพื่อรายงาน inventory อัตโนมัติ
        </p>
      </div>

      {!user.facilityId ? (
        <div className="glass-panel rounded-2xl px-6 py-8 text-center">
          <p className="text-2xl mb-2">🏥</p>
          <p className="font-medium">บัญชีของคุณยังไม่ได้ผูกกับหน่วยงาน</p>
          <p className="mt-1 text-sm text-[var(--muted)]">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยงานที่สังกัดก่อน</p>
        </div>
      ) : (
        <AgentDownloadPanel
          facilityId={user.facilityId}
          facilityName={facilityName}
          requiresWorkGroup={requiresWorkGroup}
          workGroups={workGroups}
          staticInstallKey={staticInstallKey}
        />
      )}
    </div>
  );
}
