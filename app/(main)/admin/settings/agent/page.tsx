import { redirect } from "next/navigation";
import Link from "next/link";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { AgentAutoUpdateCard } from "@/app/(main)/admin/settings/agent/_components/agent-auto-update-card";
import { AgentDeviceLifecycleCell } from "@/app/(main)/admin/settings/agent/_components/agent-device-lifecycle-cell";
import { AgentDeviceLinkCell } from "@/app/(main)/admin/settings/agent/_components/agent-device-link-cell";
import { AgentUninstallCommands } from "@/app/(main)/agent-download/_components/agent-uninstall-commands";
import { AgentEnrollmentPanel } from "@/app/(main)/admin/settings/agent/_components/agent-enrollment-panel";
import { revokeAgentEnrollmentAction } from "@/app/(main)/admin/settings/agent/actions";
import { supportsAgentAsset } from "@/lib/asset-policy";
import { listAgentDevices, listAgentEnrollments } from "@/lib/agent";
import { getFacilityBoundAgentInstallKey, getPrimaryAgentInstallKey } from "@/lib/agent-install-key";
import { AGENT_LATEST_VERSION } from "@/lib/agent-payload";
import { AGENT_SELF_UNINSTALL_MIN_VERSION } from "@/lib/agent-uninstall";
import { summarizeAgentUpdateFleet } from "@/lib/agent-update";
import { getAgentAutoUpdateSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { listAllFacilitiesForSelect, listAssetsForFacilityIds } from "@/lib/assets";
import { formatThaiDateTime } from "@/lib/date-format";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";
import { SubmitButton } from "@/app/_components/ui/submit-button";

function formatDate(value: string | null) {
  if (!value) return "-";
  return formatThaiDateTime(value);
}

function formatDiskUsage(device: { diskTotalGb: number | null; diskUsedGb: number | null; diskFreeGb: number | null }) {
  const parts = [
    device.diskTotalGb != null ? `Total ${device.diskTotalGb.toLocaleString("th-TH")} GB` : null,
    device.diskUsedGb != null ? `Used ${device.diskUsedGb.toLocaleString("th-TH")} GB` : null,
    device.diskFreeGb != null ? `Free ${device.diskFreeGb.toLocaleString("th-TH")} GB` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "-";
}

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
  // การอัปเดตอัตโนมัติมีผลทุกหน่วยงาน: แสดง/แก้ได้เฉพาะผู้ดูแลระบบส่วนกลาง
  const canManageAutoUpdate = user.role === "admin" && facilityScopeId === undefined;
  const params = await searchParams;
  const autoUpdateQuery = Array.isArray(params.autoUpdate) ? params.autoUpdate[0] : params.autoUpdate;
  const autoUpdateMessage = (autoUpdateQuery && AUTO_UPDATE_NOTICES[autoUpdateQuery]) || {};
  const scopedFilter = facilityScopeId ? { facilityId: facilityScopeId } : undefined;
  const facilities = await listAllFacilitiesForSelect(scopedFilter);
  /**
   * SEC-03: ผู้ดูแลที่ถูกจำกัดขอบเขตหน่วยงาน ต้องไม่เห็นคีย์กลางที่ใช้ได้ทุกหน่วยงาน
   * เห็นได้เฉพาะคีย์ที่ผูกกับหน่วยงานของตัวเอง (ตั้งค่าเป็น `<facilityId>:<key>` ใน ATACS_AGENT_INSTALL_KEY)
   */
  const staticInstallKey = facilityScopeId
    ? getFacilityBoundAgentInstallKey(facilityScopeId)
    : user.role === "admin"
      ? getPrimaryAgentInstallKey()
      : null;

  let enrollments = [] as Awaited<ReturnType<typeof listAgentEnrollments>>;
  let devices = [] as Awaited<ReturnType<typeof listAgentDevices>>;
  let assetOptions: Awaited<ReturnType<typeof listAssetsForFacilityIds>> = [];
  let workGroups: Awaited<ReturnType<typeof listFacilityWorkGroups>> = [];
  let dbError: string | null = null;
  const autoUpdateSettings = canManageAutoUpdate ? await getAgentAutoUpdateSettings() : null;

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--accent-strong)]">ตั้งค่าระบบ · Agent</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">ATACS Agent</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">สร้าง token ให้หน่วยงานติดตั้ง agent และติดตามเครื่องที่รายงาน inventory เข้ามาอัตโนมัติ</p>
        </div>
        <Link
          href="/admin/settings/work-groups"
          className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          จัดการกลุ่มงาน
        </Link>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {dbError}
        </div>
      ) : (
        <>
          <AgentEnrollmentPanel
            facilities={facilities.map((facility) => ({
              id: facility.id,
              facility_name: facility.facility_name,
              district_name: facility.district_name,
              typecode: facility.typecode,
            }))}
            workGroups={workGroups}
            staticInstallKey={staticInstallKey}
          />

          {canManageAutoUpdate && autoUpdateSettings ? (
            <AgentAutoUpdateCard
              settings={autoUpdateSettings}
              summary={summarizeAgentUpdateFleet(devices, autoUpdateSettings, AGENT_LATEST_VERSION)}
              latestVersion={AGENT_LATEST_VERSION}
              facilities={facilities.map((facility) => ({ id: facility.id, facility_name: facility.facility_name, district_name: facility.district_name }))}
              notice={autoUpdateMessage.notice ?? null}
              error={autoUpdateMessage.error ?? null}
            />
          ) : null}

          <AgentUninstallCommands />

          <div className="grid gap-6 2xl:grid-cols-[0.85fr_1.6fr]">
            <section className="glass-panel min-w-0 overflow-hidden rounded-2xl">
              <div className="border-b border-black/6 px-5 py-4">
                <h2 className="text-lg font-semibold">Enrollment Tokens</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">token ถูกผูกกับหน่วยงานเดียวเสมอ และสามารถปิดใช้งานได้</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                      <th className="px-4 py-3 w-14 text-right font-medium">ลำดับ</th>
                      <th className="px-4 py-3 text-left font-medium">หน่วยงาน</th>
                      <th className="px-4 py-3 text-left font-medium">ชื่อกำกับ</th>
                      <th className="px-4 py-3 text-left font-medium">กลุ่มงาน</th>
                      <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                      <th className="px-4 py-3 text-left font-medium">ใช้ล่าสุด</th>
                      <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4">
                    {enrollments.map((enrollment, rowIndex) => (
                      <tr key={enrollment.id} className="transition hover:bg-white/50">
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{(rowIndex + 1).toLocaleString("th-TH")}</td>
                        <td className="px-4 py-3 font-medium">{enrollment.facilityName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{enrollment.enrollmentName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{enrollment.workGroupName ?? "-"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={activeTone(enrollment.isActive)}>
                            {enrollment.isActive ? "ใช้งานได้" : "ปิดใช้งาน"}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{formatDate(enrollment.lastUsedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {enrollment.isActive ? (
                            <form action={revokeAgentEnrollmentAction}>
                              <input type="hidden" name="enrollmentId" value={enrollment.id} />
                              <SubmitButton
                                pendingText="กำลังปิด…"
                                confirm={{ title: `ปิด token "${enrollment.enrollmentName}" ?`, text: "เครื่องที่ยังไม่ได้ลงทะเบียนจะใช้ token นี้ไม่ได้อีก", confirmText: "ปิด token", danger: true }}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                              >
                                ปิด token
                              </SubmitButton>
                            </form>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {enrollments.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">ยังไม่มี enrollment token</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="glass-panel min-w-0 overflow-hidden rounded-2xl">
              <div className="border-b border-black/6 px-5 py-4">
                <h2 className="text-lg font-semibold">Agent Devices</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">เครื่องที่ติดตั้ง agent แล้วและส่ง inventory เข้ามาล่าสุด</p>
                {canManageAutoUpdate && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    “ถอนการติดตั้ง” — Agent {AGENT_SELF_UNINSTALL_MIN_VERSION} ขึ้นไปถอนตัวเองในรอบรายงานถัดไป (~4 ชม. หรือเปิดเครื่อง) ·
                    “ลบออกจากระบบ” — ยกเลิกกุญแจของเครื่องที่ไม่กลับมาแล้ว เก็บประวัติไว้ ไม่แตะตัวเครื่อง
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                      <th className="px-4 py-3 w-14 text-right font-medium">ลำดับ</th>
                      <th className="min-w-40 px-4 py-3 text-left font-medium whitespace-nowrap">เครื่อง</th>
                      <th className="min-w-32 px-4 py-3 text-left font-medium whitespace-nowrap">หน่วยงาน</th>
                      <th className="min-w-36 px-4 py-3 text-left font-medium whitespace-nowrap">OS / IP</th>
                      <th className="min-w-40 px-4 py-3 text-left font-medium whitespace-nowrap">Asset</th>
                      <th className="min-w-32 px-4 py-3 text-left font-medium whitespace-nowrap">ล่าสุด</th>
                      <th className="min-w-56 px-4 py-3 text-left font-medium whitespace-nowrap">การติดตั้ง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4">
                    {devices.map((device, rowIndex) => (
                      <tr key={device.id} className="transition hover:bg-white/50">
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">{(rowIndex + 1).toLocaleString("th-TH")}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{device.hostname ?? `Device #${device.id}`}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{device.deviceType ?? "Computer"} · S/N {device.serialNumber ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{device.facilityName}</td>
                        <td className="px-4 py-3">
                          <p>{device.operatingSystem ?? "-"}</p>
                          <p className="font-mono text-xs text-[var(--muted)]">{device.privateIp ?? "-"}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{formatDiskUsage(device)}</p>
                        </td>
                        <AgentDeviceLinkCell
                          deviceId={device.id}
                          facilityId={device.facilityId}
                          linkedAssetId={device.linkedAssetId}
                          linkedAssetName={device.linkedAssetName}
                          linkedAssetRegistrationNo={device.linkedAssetRegistrationNo}
                          autoLinkDisabled={device.autoLinkDisabled}
                          assets={assetOptions}
                        />
                        <td className="px-4 py-3">
	                          <StatusBadge tone={device.status === "online" ? "success" : "warning"}>
	                            {device.status}
	                          </StatusBadge>
                          <p className="mt-1 font-mono text-xs text-[var(--muted)]">{formatDate(device.lastSeenAt)}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">Agent {device.agentVersion ?? "-"}</p>
                        </td>
                        <AgentDeviceLifecycleCell
                          canManage={canManageAutoUpdate}
                          device={{
                            id: device.id,
                            hostname: device.hostname,
                            agentVersion: device.agentVersion,
                            operatingSystem: device.operatingSystem,
                            isActive: device.isActive,
                            uninstallRequestedAt: device.uninstallRequestedAt,
                            uninstallRequestedBy: device.uninstallRequestedBy,
                            uninstalledAt: device.uninstalledAt,
                          }}
                        />
                      </tr>
                    ))}
                    {devices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">ยังไม่มีเครื่องที่ enroll สำเร็จ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
