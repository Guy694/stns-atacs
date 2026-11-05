"use client";

import { useState } from "react";

import { buildLinuxAgentUninstallCommand, buildWindowsAgentUninstallCommand } from "@/lib/agent-install";

function CopyCommandButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="shrink-0 rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white"
    >
      {copied ? "คัดลอกแล้ว" : "คัดลอกคำสั่ง"}
    </button>
  );
}

/** คำสั่งถอนการติดตั้ง Agent ด้วยมือ (ใช้ได้ทุกรุ่น) วางคู่กับคำสั่งติดตั้ง */
export function AgentUninstallCommands({ compact = false, only }: { compact?: boolean; only?: "windows" | "linux" }) {
  const commands = [
    { key: "windows" as const, label: "Windows PowerShell (Run as Administrator)", command: buildWindowsAgentUninstallCommand() },
    { key: "linux" as const, label: "Linux Terminal (sudo)", command: buildLinuxAgentUninstallCommand() },
  ].filter((item) => !only || item.key === only);

  return (
    <div className={compact ? "grid gap-2" : "glass-panel rounded-2xl px-5 py-4"}>
      {!compact && (
        <>
          <p className="text-sm font-semibold">ถอนการติดตั้ง Agent ด้วยมือ</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            ใช้ได้กับ Agent ทุกรุ่น: ลบ Scheduled Task / systemd timer, ไฟล์ตั้งค่าที่มีกุญแจของเครื่อง และโฟลเดอร์ติดตั้ง
            พร้อมแจ้งเซิร์ฟเวอร์ให้ขึ้นสถานะ “ถอนการติดตั้งแล้ว” (ถ้ายังมีไฟล์ตั้งค่า) — Agent 2.2.0 ขึ้นไปสั่งถอนจากระยะไกลได้ที่ ตั้งค่าระบบ › Agent
          </p>
        </>
      )}
      <div className={compact ? "grid gap-2" : "mt-3 grid gap-3"}>
        {commands.map((item) => (
          <div key={item.key} className="rounded-xl border border-black/10 bg-white/90 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{item.label}</p>
              <CopyCommandButton text={item.command} />
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-rose-100">
              {item.command}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
