"use client";

import { useRef, useState, useTransition } from "react";

import {
  cancelAgentUninstallAction,
  requestAgentUninstallAction,
  retireAgentDeviceAction,
  type AgentDeviceLifecycleActionResult,
} from "@/app/(main)/admin/settings/agent/actions";
import { AgentUninstallCommands } from "@/app/(main)/agent-download/_components/agent-uninstall-commands";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { confirmAction } from "@/app/_components/ui/confirm";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { toast } from "@/app/_components/ui/toast";
import { useEscapeToClose } from "@/app/_components/ui/use-escape-to-close";
import { useModalA11y } from "@/app/_components/ui/use-modal-a11y";
import {
  AGENT_LIFECYCLE_LABELS,
  AGENT_SELF_UNINSTALL_MIN_VERSION,
  agentLifecycleState,
  agentVersionSupportsSelfUninstall,
} from "@/lib/agent-uninstall";
import { formatThaiDateTime } from "@/lib/date-format";

export type AgentLifecycleDevice = {
  id: number;
  hostname: string | null;
  agentVersion: string | null;
  operatingSystem: string | null;
  isActive: boolean;
  uninstallRequestedAt: string | null;
  uninstallRequestedBy: string | null;
  uninstalledAt: string | null;
};

type Props = {
  device: AgentLifecycleDevice;
  /** ผู้ดูแลระบบส่วนกลางเท่านั้น */
  canManage: boolean;
};

/** สถานะวงจรชีวิตของเครื่อง (แสดงเฉพาะเมื่อไม่ใช่ "ใช้งานอยู่") ใช้ในคอลัมน์สถานะ */
export function AgentLifecycleStatus({ device }: { device: AgentLifecycleDevice }) {
  const state = agentLifecycleState(device);
  const selfUninstall = agentVersionSupportsSelfUninstall(device.agentVersion);
  if (state === "active") return null;
  if (state === "uninstall-pending") {
    return (
      <div className="mt-1.5">
        <StatusBadge tone="warning">{AGENT_LIFECYCLE_LABELS["uninstall-pending"]}</StatusBadge>
        <p className="mt-1 text-xs text-[var(--muted)]">
          สั่งเมื่อ {formatThaiDateTime(device.uninstallRequestedAt)}{device.uninstallRequestedBy ? ` โดย ${device.uninstallRequestedBy}` : ""}
        </p>
        {!selfUninstall && (
          <p className="mt-1 text-xs font-medium text-[var(--state-warning-fg)]">รุ่นนี้ถอนเองไม่ได้ — ใช้คำสั่งถอนด้วยมือ หรือลบออกจากระบบ</p>
        )}
      </div>
    );
  }
  if (state === "uninstalled") {
    return (
      <div className="mt-1.5">
        <StatusBadge tone="neutral">{AGENT_LIFECYCLE_LABELS.uninstalled}</StatusBadge>
        <p className="mt-1 text-xs text-[var(--muted)]">{formatThaiDateTime(device.uninstalledAt)}</p>
      </div>
    );
  }
  return (
    <div className="mt-1.5">
      <StatusBadge tone="neutral">{AGENT_LIFECYCLE_LABELS.retired}</StatusBadge>
    </div>
  );
}

function ManualUninstallDialog({ label, platform, onClose }: { label: string; platform?: "windows" | "linux"; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeToClose(true, onClose);
  useModalA11y(true, dialogRef);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`คำสั่งถอนการติดตั้งด้วยมือ ${label}`} className="glass-panel w-full max-w-2xl rounded-2xl p-5 text-left shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">คำสั่งถอนการติดตั้งด้วยมือ</h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">รันที่เครื่อง {label} ด้วยสิทธิ์ผู้ดูแลเครื่อง</p>
          </div>
          <ActionIconButton icon="close" label="ปิด" onClick={onClose} />
        </div>
        <AgentUninstallCommands compact only={platform} />
      </div>
    </div>
  );
}

/** ปุ่มจัดการเครื่องแบบไอคอน (มีคำอธิบายเมื่อชี้/อ่านหน้าจอ): ถอนการติดตั้ง / ยกเลิกคำสั่ง / คำสั่งถอนด้วยมือ / ลบออกจากระบบ */
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

  const manageable = canManage && (state === "active" || state === "uninstall-pending");

  return (
    <td className="px-4 py-2 text-right align-middle">
      {manageable ? (
        <div className="inline-flex items-center justify-end gap-1.5">
          {state === "active" ? (
            <ActionIconButton icon="power-off" tone="danger" label="ถอนการติดตั้ง" disabled={pending} onClick={requestUninstall} />
          ) : (
            <ActionIconButton icon="undo" label="ยกเลิกคำสั่งถอนการติดตั้ง" disabled={pending} onClick={cancelUninstall} />
          )}
          {(!selfUninstall || state === "uninstall-pending") && (
            <ActionIconButton icon="file-text" label="คำสั่งถอนด้วยมือ" onClick={() => setShowManual(true)} />
          )}
          <ActionIconButton icon="trash" tone="danger" label="ลบออกจากระบบ" disabled={pending} onClick={retire} />
        </div>
      ) : (
        <span className="text-xs text-[var(--muted)]">—</span>
      )}
      {pending && <p className="mt-1 text-xs text-[var(--muted)]" aria-live="polite">กำลังบันทึก…</p>}
      {showManual && <ManualUninstallDialog label={label} platform={platform} onClose={() => setShowManual(false)} />}
    </td>
  );
}
