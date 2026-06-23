import { redirect } from "next/navigation";

import { StatusBadge, activeTone } from "@/app/_components/ui/status-badge";
import { AgentDeviceLinkCell } from "@/app/(main)/admin/settings/agent/_components/agent-device-link-cell";
import { AgentEnrollmentPanel } from "@/app/(main)/admin/settings/agent/_components/agent-enrollment-panel";
import { revokeAgentEnrollmentAction } from "@/app/(main)/admin/settings/agent/actions";
import { listAgentDevices, listAgentEnrollments } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import { listAllFacilitiesForSelect, listAssetsForFacilityIds } from "@/lib/assets";
import { formatThaiDateTime } from "@/lib/date-format";
import { hasPermission } from "@/lib/role-permissions";

function formatDate(value: string | null) {
  if (!value) return "-";
  return formatThaiDateTime(value);
}

export default async function AgentSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowAgentManage = user.role === "admin" || (await hasPermission(user.role, "agent.manage"));
  if (!allowAgentManage) redirect("/");

  const facilities = await listAllFacilitiesForSelect();

  let enrollments = [] as Awaited<ReturnType<typeof listAgentEnrollments>>;
  let devices = [] as Awaited<ReturnType<typeof listAgentDevices>>;
  let assetOptions: Awaited<ReturnType<typeof listAssetsForFacilityIds>> = [];
  let dbError: string | null = null;

  try {
    [enrollments, devices] = await Promise.all([listAgentEnrollments(), listAgentDevices()]);
    const facilityIds = [...new Set(devices.map((d) => d.facilityId))];
    assetOptions = await listAssetsForFacilityIds(facilityIds);
  } catch {
    dbError = "ยังไม่พบตาราง agent_enrollments / agent_devices กรุณารัน database/agent_inventory.sql ก่อน";
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · Agent Enrollment</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ATACS Agent</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">สร้าง token ให้หน่วยงานติดตั้ง agent และติดตามเครื่องที่รายงาน inventory เข้ามาอัตโนมัติ</p>
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
            }))}
          />

          <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
            <section className="glass-panel overflow-hidden rounded-2xl">
              <div className="border-b border-black/6 px-5 py-4">
                <h2 className="text-lg font-semibold">Enrollment Tokens</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">token ถูกผูกกับหน่วยงานเดียวเสมอ และสามารถปิดใช้งานได้</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                      <th className="px-4 py-3 text-left font-medium">หน่วยงาน</th>
                      <th className="px-4 py-3 text-left font-medium">ชื่อกำกับ</th>
                      <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                      <th className="px-4 py-3 text-left font-medium">ใช้ล่าสุด</th>
                      <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4">
                    {enrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="transition hover:bg-white/50">
                        <td className="px-4 py-3 font-medium">{enrollment.facilityName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{enrollment.enrollmentName}</td>
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
                              <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                                ปิด token
                              </button>
                            </form>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {enrollments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">ยังไม่มี enrollment token</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="glass-panel overflow-hidden rounded-2xl">
              <div className="border-b border-black/6 px-5 py-4">
                <h2 className="text-lg font-semibold">Agent Devices</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">เครื่องที่ติดตั้ง agent แล้วและส่ง inventory เข้ามาล่าสุด</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                      <th className="px-4 py-3 text-left font-medium">เครื่อง</th>
                      <th className="px-4 py-3 text-left font-medium">หน่วยงาน</th>
                      <th className="px-4 py-3 text-left font-medium">OS / IP</th>
                      <th className="px-4 py-3 text-left font-medium">Asset</th>
                      <th className="px-4 py-3 text-left font-medium">ล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4">
                    {devices.map((device) => (
                      <tr key={device.id} className="transition hover:bg-white/50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{device.hostname ?? `Device #${device.id}`}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{device.deviceType ?? "Computer"} · S/N {device.serialNumber ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{device.facilityName}</td>
                        <td className="px-4 py-3">
                          <p>{device.operatingSystem ?? "-"}</p>
                          <p className="font-mono text-xs text-[var(--muted)]">{device.privateIp ?? "-"}</p>
                        </td>
                        <AgentDeviceLinkCell
                          deviceId={device.id}
                          facilityId={device.facilityId}
                          linkedAssetId={device.linkedAssetId}
                          linkedAssetName={device.linkedAssetName}
                          linkedAssetRegistrationNo={device.linkedAssetRegistrationNo}
                          assets={assetOptions}
                        />
                        <td className="px-4 py-3">
	                          <StatusBadge tone={device.status === "online" ? "success" : "warning"}>
	                            {device.status}
	                          </StatusBadge>
                          <p className="mt-1 font-mono text-xs text-[var(--muted)]">{formatDate(device.lastSeenAt)}</p>
                        </td>
                      </tr>
                    ))}
                    {devices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">ยังไม่มีเครื่องที่ enroll สำเร็จ</td>
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
