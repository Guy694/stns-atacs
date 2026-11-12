/**
 * N6: เครื่องที่ไม่ส่งข้อมูลนาน → เสนอให้ผู้ดูแลยืนยันเลิกใช้ ("ลบออกจากระบบ" = ยกเลิกกุญแจ เก็บประวัติ)
 * ไฟล์นี้ไม่แตะฐานข้อมูล
 */
import { agentVersionSupportsSelfUninstall, isAgentDeviceInService } from "@/lib/agent-uninstall";

export function staleAgentDays(env: Record<string, string | undefined>) {
  const days = Number(env.AGENT_STALE_DAYS);
  return Number.isInteger(days) && days >= 14 ? days : 60;
}

export type StaleAgentInput = {
  id: number;
  hostname: string | null;
  facilityName: string;
  agentVersion: string | null;
  isActive: boolean;
  uninstallRequestedAt: string | null;
  uninstalledAt: string | null;
  lastReportedAt: string | null;
  lastSeenAt: string | null;
  firstSeenAt: string;
};

export type StaleAgent = StaleAgentInput & { lastContactAt: string; daysSilent: number; selfUninstall: boolean };

const DAY = 24 * 60 * 60 * 1000;

/** เครื่องที่ยังนับว่าใช้งานอยู่ แต่ไม่ได้ติดต่อมาเกิน `days` วัน เรียงจากเงียบนานที่สุด */
export function findStaleAgents(devices: readonly StaleAgentInput[], now: number, days: number): StaleAgent[] {
  return devices
    .filter((device) => isAgentDeviceInService(device))
    .map((device) => {
      const lastContactAt = device.lastReportedAt ?? device.lastSeenAt ?? device.firstSeenAt;
      return {
        ...device,
        lastContactAt,
        daysSilent: Math.floor((now - Date.parse(lastContactAt)) / DAY),
        selfUninstall: agentVersionSupportsSelfUninstall(device.agentVersion),
      };
    })
    .filter((device) => device.daysSilent >= days)
    .sort((a, b) => b.daysSilent - a.daysSilent);
}
