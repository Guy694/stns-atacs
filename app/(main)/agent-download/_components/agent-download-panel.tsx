"use client";

import { useActionState, useState } from "react";

import { createOfficerDownloadTokenAction } from "@/app/(main)/agent-download/actions";

type AgentDownloadPanelProps = {
  facilityName: string;
};

const INITIAL = { token: null as string | null, error: null as string | null };

const SCRIPT_BASE = "/api/agent/download";

function CopyButton({ text }: { text: string }) {
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
      className="shrink-0 rounded-lg border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-white"
    >
      {copied ? "✓ คัดลอก" : "คัดลอก"}
    </button>
  );
}

export function AgentDownloadPanel({ facilityName }: AgentDownloadPanelProps) {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof INITIAL) => createOfficerDownloadTokenAction(),
    INITIAL
  );

  const apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://YOUR-ATACS";
  const token = state.token;

  const winCmd = token
    ? `powershell -ExecutionPolicy Bypass -File .\\install-atacs-agent.ps1 -ApiBaseUrl "${apiBaseUrl}" -EnrollmentToken "${token}"`
    : "";
  const linuxCmd = token
    ? `sudo bash ./install-atacs-agent.sh --api-base-url "${apiBaseUrl}" --enrollment-token "${token}"`
    : "";

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

          {/* Windows */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">🖥 Windows</p>
              <div className="flex gap-2">
                <a href={`${SCRIPT_BASE}?file=windows-agent`} download="atacs-agent.ps1" className="rounded-lg border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-white">atacs-agent.ps1</a>
                <a href={`${SCRIPT_BASE}?file=windows-installer`} download="install-atacs-agent.ps1" className="rounded-lg border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-white">installer.ps1</a>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-x-auto rounded-xl bg-stone-950 px-4 py-3 font-mono text-[11px] text-emerald-200 pr-20">
                {winCmd}
              </div>
              <div className="absolute right-2 top-2">
                <CopyButton text={winCmd} />
              </div>
            </div>
          </div>

          {/* Linux */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">🐧 Linux</p>
              <div className="flex gap-2">
                <a href={`${SCRIPT_BASE}?file=linux-agent`} download="atacs-agent.py" className="rounded-lg border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-white">atacs-agent.py</a>
                <a href={`${SCRIPT_BASE}?file=linux-installer`} download="install-atacs-agent.sh" className="rounded-lg border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-white">installer.sh</a>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-x-auto rounded-xl bg-stone-950 px-4 py-3 font-mono text-[11px] text-emerald-200 pr-20">
                {linuxCmd}
              </div>
              <div className="absolute right-2 top-2">
                <CopyButton text={linuxCmd} />
              </div>
            </div>
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
