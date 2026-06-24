"use client";

import { useActionState, useState } from "react";

import { createOfficerDownloadTokenAction } from "@/app/(main)/agent-download/actions";
import { buildWindowsAgentInstallCommand } from "@/lib/agent-install";

type AgentDownloadPanelProps = {
  facilityName: string;
};

const INITIAL = { token: null as string | null, error: null as string | null };

function CopyButton({ text, label = "คัดลอก" }: { text: string; label?: string }) {
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
      className="shrink-0 rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white disabled:opacity-50"
    >
      {copied ? "คัดลอกแล้ว" : label}
    </button>
  );
}

export function AgentDownloadPanel({ facilityName }: AgentDownloadPanelProps) {
  const [state, formAction, pending] = useActionState(
    async () => createOfficerDownloadTokenAction(),
    INITIAL
  );

  const token = state.token;

  const winCmd = token ? buildWindowsAgentInstallCommand(token) : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-panel rounded-2xl px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">หน่วยงาน</p>
        <p className="mt-1 text-lg font-semibold">{facilityName}</p>
      </div>

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {!token ? (
        <div className="glass-panel rounded-2xl px-5 py-6 text-center">
          <p className="text-sm text-[var(--muted)] mb-4">
            กดปุ่มด้านล่างเพื่อสร้าง enrollment token สำหรับติดตั้ง agent บนเครื่องของหน่วยงาน
          </p>
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--accent-strong)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "กำลังสร้าง token…" : "สร้าง Enrollment Token"}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Enrollment Token</p>
              <CopyButton text={token} />
            </div>
            <div className="rounded-xl bg-stone-950 px-4 py-3 font-mono text-xs text-emerald-200 break-all">
              {token}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Token นี้มีอายุ 7 วัน — ใช้ได้สำหรับหน่วยงาน{facilityName}เท่านั้น</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-emerald-950">ติดตั้งบน Windows ด้วยคำสั่งเดียว</p>
                <p className="mt-1 text-sm text-emerald-800">
                  เปิด PowerShell แบบ Run as Administrator แล้ววางคำสั่งนี้ ระบบจะดาวน์โหลด agent และติดตั้งให้อัตโนมัติ
                </p>
              </div>
              <CopyButton text={winCmd} label="คัดลอกคำสั่ง" />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl bg-stone-950 px-4 py-3 font-mono text-[11px] leading-5 text-emerald-200">
                {winCmd}
            </div>
            <p className="mt-2 text-xs text-emerald-800">ไม่ต้องดาวน์โหลดไฟล์เอง คำสั่งนี้รวม token และ URL ระบบไว้แล้ว</p>
          </div>

          <div className="glass-panel rounded-2xl px-5 py-4 text-center">
            <form action={formAction}>
              <button
                type="submit"
                disabled={pending}
                className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
              >
                สร้าง token ใหม่ (ยกเลิก token ปัจจุบัน)
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
