import { redirect } from "next/navigation";
import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { AgentAutoUpdateCard } from "@/app/(main)/admin/settings/agent/_components/agent-auto-update-card";
import { AgentDevicesTable, type AgentDeviceRow } from "@/app/(main)/admin/settings/agent/_components/agent-devices-table";
import { InstallCommandPanel } from "@/app/(main)/admin/settings/agent/_components/install-command-panel";
import { InstallScopeList, type InstallScopeRow, type LegacyEnrollmentRow } from "@/app/(main)/admin/settings/agent/_components/install-scope-list";
import { getInstallCommand } from "@/app/(main)/admin/settings/agent/actions";
import { AgentUninstallCommands } from "@/app/(main)/agent-download/_components/agent-uninstall-commands";
import { supportsAgentAsset } from "@/lib/asset-policy";
import { listAgentDevices, listAgentEnrollments } from "@/lib/agent";
import { isInstallScopeEnrollmentName } from "@/lib/agent-install-command";
import { agentOfflineThresholdMinutes, effectiveAgentStatus } from "@/lib/agent-monitor-summary";
import { AGENT_LATEST_VERSION } from "@/lib/agent-payload";
import { AGENT_SELF_UNINSTALL_MIN_VERSION } from "@/lib/agent-uninstall";
import { summarizeAgentUpdateFleet } from "@/lib/agent-update";
import { getAgentAutoUpdateSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { listAllFacilitiesForSelect, listAssetsForFacilityIds } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { listFacilityWorkGroups, requiresAgentWorkGroup } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import { summarizeUnknownAgents } from "@/lib/agent-auth-failure";
import { listUnknownAgentEvents } from "@/lib/security-dashboard-data";
import { ensureIpGeoInBackground, geoForIps } from "@/lib/visitor-log-data";
import { UnknownAgentsPanel } from "@/app/(main)/admin/settings/agent/_components/unknown-agents-panel";

const AUTO_UPDATE_NOTICES: Record<string, { notice?: string; error?: string }> = {
  saved: { notice: "บันทึกการตั้งค่าอัปเดต Agent แล้ว" },
  invalid: { error: "โหมดการอัปเดตไม่ถูกต้อง" },
  "no-pilot": { error: "โหมดนำร่องต้องเลือกหน่วยงานอย่างน้อย 1 แห่ง" },
  "too-many": { error: "เลือกหน่วยงานนำร่องมากเกินไป ให้ใช้โหมด “ทุกหน่วยงาน” แทน" },
  failed: { error: "บันทึกการตั้งค่าไม่สำเร็จ" },
};

type AgentSettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgentSettingsPage({ searchParams }: AgentSettingsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowAgentManage = user.role === "admin" || (await hasPermission(user.role, "agent.manage"));
  if (!allowAgentManage) redirect("/dashboard");

  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");
  // การอัปเดตอัตโนมัติและการถอน/ลบเครื่องมีผลทุกหน่วยงาน: เฉพาะผู้ดูแลระบบส่วนกลาง
  const isCentralAdmin = user.role === "admin" && facilityScopeId === undefined;
  const params = await searchParams;
  const autoUpdateQuery = Array.isArray(params.autoUpdate) ? params.autoUpdate[0] : params.autoUpdate;
  const autoUpdateMessage = (autoUpdateQuery && AUTO_UPDATE_NOTICES[autoUpdateQuery]) || {};
  const scopedFilter = facilityScopeId ? { facilityId: facilityScopeId } : undefined;
  const facilities = await listAllFacilitiesForSelect(scopedFilter);
  const typecodeById = new Map(facilities.map((facility) => [facility.id, facility.typecode ?? null]));

  let enrollments = [] as Awaited<ReturnType<typeof listAgentEnrollments>>;
  let devices = [] as Awaited<ReturnType<typeof listAgentDevices>>;
  let assetOptions: Awaited<ReturnType<typeof listAssetsForFacilityIds>> = [];
  let workGroups: Awaited<ReturnType<typeof listFacilityWorkGroups>> = [];
  let dbError: string | null = null;
  const autoUpdateSettings = isCentralAdmin ? await getAgentAutoUpdateSettings() : null;

  try {
    [enrollments, devices, workGroups] = await Promise.all([
      listAgentEnrollments(scopedFilter),
      listAgentDevices(scopedFilter),
      listFacilityWorkGroups(facilityScopeId || undefined),
    ]);
    const facilityIds = [...new Set(devices.map((d) => d.facilityId))];
    assetOptions = (await listAssetsForFacilityIds(facilityIds)).filter(supportsAgentAsset);
  } catch {
    dbError = "ยังไม่พบโครงสร้าง Agent หรือกลุ่มงาน กรุณารัน database/agent_inventory.sql และ database/add_facility_work_groups.sql ก่อน";
  }

  // SEC8: agents reporting with an id that no longer exists (central admins only — they span every facility).
  const unknownAgents = isCentralAdmin ? summarizeUnknownAgents(await listUnknownAgentEvents().catch(() => [])) : [];
  const unknownAgentGeo = await geoForIps(unknownAgents.map((agent) => agent.ips[0]));
  ensureIpGeoInBackground(unknownAgents.map((agent) => agent.ips[0]).filter((ip) => !unknownAgentGeo.has(ip)));

  // Server component: one timestamp per request so relative times match on server and client.
  const nowMs = new Date().getTime();
  const offlineMinutes = agentOfflineThresholdMinutes(process.env.AGENT_OFFLINE_MINUTES);
  // X1: never trust the stored 'online' alone — it only flips when the agent-health cron runs.
  const liveStatus = (device: (typeof devices)[number]) =>
    effectiveAgentStatus({ lastSeenAt: device.lastSeenAt, status: device.status, isActive: device.isActive }, new Date(nowMs), offlineMinutes);
  const devicesPerEnrollment = new Map<number, number>();
  for (const device of devices) {
    if (device.enrollmentId != null && device.isActive) {
      devicesPerEnrollment.set(device.enrollmentId, (devicesPerEnrollment.get(device.enrollmentId) ?? 0) + 1);
    }
  }

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.isActive);
  const scopes: InstallScopeRow[] = activeEnrollments
    .filter((enrollment) => isInstallScopeEnrollmentName(enrollment.enrollmentName))
    .map((enrollment) => ({
      key: String(enrollment.id),
      facilityId: enrollment.facilityId,
      facilityName: enrollment.facilityName,
      workGroupId: enrollment.workGroupId,
      workGroupName: enrollment.workGroupName,
      deviceCount: devicesPerEnrollment.get(enrollment.id) ?? 0,
      lastUsedAt: enrollment.lastUsedAt,
      createdAt: enrollment.createdAt,
    }));
  const legacy: LegacyEnrollmentRow[] = activeEnrollments
    .filter((enrollment) => !isInstallScopeEnrollmentName(enrollment.enrollmentName))
    .map((enrollment) => ({
      id: enrollment.id,
      facilityName: enrollment.facilityName,
      enrollmentName: enrollment.enrollmentName,
      workGroupName: enrollment.workGroupName,
      expiresAt: enrollment.expiresAt,
      lastUsedAt: enrollment.lastUsedAt,
    }));

  const deviceRows: AgentDeviceRow[] = devices.map((device) => ({
    id: device.id,
    hostname: device.hostname,
    agentVersion: device.agentVersion,
    operatingSystem: device.operatingSystem,
    isActive: device.isActive,
    uninstallRequestedAt: device.uninstallRequestedAt,
    uninstallRequestedBy: device.uninstallRequestedBy,
    uninstalledAt: device.uninstalledAt,
    facilityId: device.facilityId,
    facilityName: device.facilityName,
    facilityTypecode: typecodeById.get(device.facilityId) ?? null,
    deviceType: device.deviceType,
    serialNumber: device.serialNumber,
    privateIp: device.privateIp,
    status: liveStatus(device),
    lastSeenAt: device.lastReportedAt ?? device.lastSeenAt,
    diskTotalGb: device.diskTotalGb,
    diskFreeGb: device.diskFreeGb,
    linkedAssetId: device.linkedAssetId,
    linkedAssetName: device.linkedAssetName,
    linkedAssetRegistrationNo: device.linkedAssetRegistrationNo,
    autoLinkDisabled: device.autoLinkDisabled,
  }));

  const activeCount = devices.filter((device) => device.isActive).length;
  const onlineCount = devices.filter((device) => liveStatus(device) === "online").length;
  const openFacilities = new Set(scopes.map((scope) => scope.facilityId)).size;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <header className="glass-panel relative isolate overflow-hidden rounded-2xl px-5 py-5 sm:px-6">
        <PhotoBackdrop image="it-storage" fade="left" opacity="opacity-[0.12]" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="section-title text-2xl font-semibold sm:text-3xl">ATACS Agent</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              เลือกหน่วยงานแล้วคัดลอกคำสั่งไปวางที่เครื่องปลายทาง เครื่องจะลงทะเบียนและรายงานข้อมูลฮาร์ดแวร์เข้าระบบเอง
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="whitespace-nowrap text-xs text-[var(--muted)]">เครื่องที่ใช้งาน</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{activeCount.toLocaleString("th-TH")}</dd>
            </div>
            <div>
              <dt className="whitespace-nowrap text-xs text-[var(--muted)]">ออนไลน์</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--state-success-fg)]">{onlineCount.toLocaleString("th-TH")}</dd>
            </div>
            <div>
              <dt className="whitespace-nowrap text-xs text-[var(--muted)]">หน่วยงานที่เปิดติดตั้ง</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{openFacilities.toLocaleString("th-TH")}</dd>
            </div>
          </dl>
        </div>
      </header>

      {dbError ? (
        <div role="alert" className="rounded-xl border border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] px-5 py-4 text-sm text-[var(--state-warning-fg)]">
          {dbError}
        </div>
      ) : (
        <>
          <InstallCommandPanel
            facilities={facilities.map((facility) => ({
              id: facility.id,
              name: facility.facility_name,
              typecode: facility.typecode,
              districtName: facility.district_name,
              requiresWorkGroup: requiresAgentWorkGroup(facility.typecode),
            }))}
            workGroups={workGroups.map((group) => ({ id: group.id, facilityId: group.facilityId, workGroupName: group.workGroupName }))}
            getCommand={getInstallCommand}
            manageWorkGroupsHref="/admin/settings/work-groups/"
          />

          <div className="flex flex-col gap-2">
            <AgentDevicesTable devices={deviceRows} assets={assetOptions} canManage={isCentralAdmin} nowMs={nowMs} />
            {isCentralAdmin && (
              <p className="px-1 text-xs text-[var(--muted)]">
                ถอนการติดตั้ง: Agent {AGENT_SELF_UNINSTALL_MIN_VERSION} ขึ้นไปถอนตัวเองในรอบรายงานถัดไป (ประมาณ 4 ชั่วโมงหรือเมื่อเปิดเครื่อง) ·
                ลบออกจากระบบ: ยกเลิกสิทธิ์ของเครื่องที่ไม่กลับมาแล้ว เก็บประวัติไว้ ไม่แตะตัวเครื่อง
              </p>
            )}
          </div>

          <UnknownAgentsPanel agents={unknownAgents} geo={unknownAgentGeo} />

          <InstallScopeList scopes={scopes} legacy={legacy} nowMs={nowMs} />

          {isCentralAdmin && autoUpdateSettings ? (
            <AgentAutoUpdateCard
              settings={autoUpdateSettings}
              summary={summarizeAgentUpdateFleet(devices, autoUpdateSettings, AGENT_LATEST_VERSION)}
              latestVersion={AGENT_LATEST_VERSION}
              facilities={facilities.map((facility) => ({ id: facility.id, facility_name: facility.facility_name, district_name: facility.district_name }))}
              notice={autoUpdateMessage.notice ?? null}
              error={autoUpdateMessage.error ?? null}
            />
          ) : null}

          <details className="glass-panel group rounded-2xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <AppIcon name="power-off" size={16} className="text-[var(--muted)]" />
                คำสั่งถอนการติดตั้งด้วยมือ
              </span>
              <AppIcon name="chevron-down" size={16} className="text-[var(--muted)] transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--line)] px-5 py-4">
              <AgentUninstallCommands compact />
            </div>
          </details>

          <p className="text-xs text-[var(--muted)]">
            หน่วยงานโรงพยาบาล สสจ. และ สสอ. ต้องเลือกกลุ่มงานก่อนติดตั้ง ·{" "}
            <Link href="/admin/settings/work-groups/" className="font-medium text-[var(--primary-text)] underline underline-offset-2">
              จัดการกลุ่มงาน
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
