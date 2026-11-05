"use client";

import { useState, useTransition } from "react";

import {
  cancelAgentUninstallAction,
  requestAgentUninstallAction,
  retireAgentDeviceAction,
  type AgentDeviceLifecycleActionResult,
} from "@/app/(main)/admin/settings/agent/actions";
import { AgentUninstallCommands } from "@/app/(main)/agent-download/_components/agent-uninstall-commands";
import { confirmAction } from "@/app/_components/ui/confirm";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { toast } from "@/app/_components/ui/toast";
import {
  AGENT_LIFECYCLE_LABELS,
  AGENT_SELF_UNINSTALL_MIN_VERSION,
  agentLifecycleState,
  agentVersionSupportsSelfUninstall,
} from "@/lib/agent-uninstall";
import { formatThaiDateTime } from "@/lib/date-format";

type Props = {
  device: {
    id: number;
    hostname: string | null;
    agentVersion: string | null;
    operatingSystem: string | null;
    isActive: boolean;
    uninstallRequestedAt: string | null;
    uninstallRequestedBy: string | null;
    uninstalledAt: string | null;
  };
  /** ผู้ดูแลระบบส่วนกลางเท่านั้น */
  canManage: boolean;
};

const buttonClass = "whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50";

export function AgentDeviceLifecycleCell({ device, canManage }: Props) {
  const [pending, startTransition] = useTransition();
  const [showManual, setShowManual] = useState(false);
  const state = agentLifecycleState(device);
  const label = device.hostname ?? `Device #${device.id}`;
  const selfUninstall = agentVersionSupportsSelfUninstall(device.agentVersion);
  const platform = /windows/i.test(device.operatingSystem ?? "") ? "windows" : /linux|ubuntu|debian|centos|rhel|rocky|alma|fedora|suse/i.test(device.operatingSystem ?? "") ? "linux" : undefined;

  function run(action: (formData: FormData) => Promise<AgentDeviceLifecycleActionResult>) {
    const formData = new FormData();
    formData.set("deviceId", String(device.id));
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch {
        toast.error("ทำรายการไม่สำเร็จ กรุณาลองใหม่");
      }
    });
  }

  async function requestUninstall() {
    const ok = await confirmAction({
      title: `ถอนการติดตั้ง Agent จาก ${label} ?`,
      text: selfUninstall
        ? "Agent จะถอนตัวเองในรอบรายงานถัดไป (ทุก ~4 ชั่วโมง หรือเมื่อเปิดเครื่อง): ยืนยันกับเซิร์ฟเวอร์ แล้วลบ Scheduled Task / systemd timer, ไฟล์ตั้งค่าที่มีกุญแจของเครื่อง และโฟลเดอร์ติดตั้ง จากนั้นเครื่องนี้จะส่งข้อมูลไม่ได้อีก ประวัติและทะเบียนทรัพย์สินยังอยู่ ยกเลิกคำสั่งได้จนกว่าเครื่องจะทำ"
        : `Agent รุ่น ${device.agentVersion ?? "ไม่ทราบ"} ถอนเองไม่ได้ (ต้องเป็น ${AGENT_SELF_UNINSTALL_MIN_VERSION} ขึ้นไป) คำสั่งจะค้างไว้ — ให้รันคำสั่งถอนด้วยมือที่เครื่อง หรือใช้ “ลบออกจากระบบ” ถ้าเครื่องไม่กลับมาแล้ว`,
      confirmText: "สั่งถอนการติดตั้ง",
      danger: true,
    });
    if (ok) run(requestAgentUninstallAction);
  }

  async function cancelUninstall() {
    const ok = await confirmAction({
      title: `ยกเลิกคำสั่งถอนการติดตั้ง ${label} ?`,
      text: "Agent จะทำงานต่อตามปกติ (ถ้าเครื่องรับคำสั่งและถอนไปแล้ว ยกเลิกไม่ได้)",
      confirmText: "ยกเลิกคำสั่ง",
    });
    if (ok) run(cancelAgentUninstallAction);
  }

  async function retire() {
    const ok = await confirmAction({
      title: `ลบ ${label} ออกจากระบบ ?`,
      text: "สำหรับเครื่องที่ไม่กลับมาแล้ว (เสีย จำหน่าย ติดตั้งใหม่) หรือ Agent รุ่นเก่าที่ถอนเองไม่ได้: ยกเลิกกุญแจของเครื่องทันที รายงานถัดไปจะถูกปฏิเสธ ไม่นับในยอดออนไลน์/ออฟไลน์และไม่แจ้งเตือนออฟไลน์อีก ประวัติและทะเบียนยังอยู่ — ไม่ลบโปรแกรมในเครื่อง (ถ้าเครื่องยังใช้งานให้รันคำสั่งถอนด้วยมือด้วย) ถ้าติดตั้งใหม่ภายหลังจะกลับมาเป็นเครื่องเดิม",
      confirmText: "ลบออกจากระบบ",
      danger: true,
    });
    if (ok) run(retireAgentDeviceAction);
  }

  return (
    <td className="min-w-56 px-4 py-3 align-top">
      {state === "active" && <StatusBadge tone="success">{AGENT_LIFECYCLE_LABELS.active}</StatusBadge>}
      {state === "uninstall-pending" && (
        <div>
          <StatusBadge tone="warning">{AGENT_LIFECYCLE_LABELS["uninstall-pending"]}</StatusBadge>
          <p className="mt-1 text-xs text-[var(--muted)]">
            สั่งเมื่อ {formatThaiDateTime(device.uninstallRequestedAt)}{device.uninstallRequestedBy ? ` โดย ${device.uninstallRequestedBy}` : ""}
          </p>
          {!selfUninstall && (
            <p className="mt-1 text-xs font-medium text-amber-800">agent รุ่นนี้ถอนเองไม่ได้ — ใช้คำสั่งถอนด้วยมือ หรือลบออกจากระบบ</p>
          )}
        </div>
      )}
      {state === "uninstalled" && (
        <div>
          <StatusBadge tone="neutral">{AGENT_LIFECYCLE_LABELS.uninstalled}</StatusBadge>
          <p className="mt-1 text-xs text-[var(--muted)]">{formatThaiDateTime(device.uninstalledAt)}</p>
        </div>
      )}
      {state === "retired" && <StatusBadge tone="neutral">{AGENT_LIFECYCLE_LABELS.retired}</StatusBadge>}

      {canManage && (state === "active" || state === "uninstall-pending") && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {state === "active" ? (
            <button type="button" disabled={pending} onClick={requestUninstall} className={`${buttonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>
              ถอนการติดตั้ง
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={cancelUninstall} className={`${buttonClass} border-black/10 bg-white/80 hover:bg-white`}>
              ยกเลิกคำสั่ง
            </button>
          )}
          <button type="button" disabled={pending} onClick={retire} className={`${buttonClass} border-black/10 bg-white/80 text-rose-700 hover:bg-white`}>
            ลบออกจากระบบ
          </button>
          {(!selfUninstall || state === "uninstall-pending") && (
            <button type="button" onClick={() => setShowManual((value) => !value)} className={`${buttonClass} border-transparent text-[var(--accent)] underline-offset-2 hover:underline`}>
              {showManual ? "ซ่อนคำสั่งถอนด้วยมือ" : "คำสั่งถอนด้วยมือ"}
            </button>
          )}
        </div>
      )}
      {showManual && (
        <div className="mt-2 w-[min(32rem,80vw)]">
          <AgentUninstallCommands compact only={platform} />
        </div>
      )}
      {pending && <p className="mt-1 text-xs text-[var(--muted)]">กำลังบันทึก...</p>}
    </td>
  );
}
