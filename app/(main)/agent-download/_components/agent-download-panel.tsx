"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createOfficerDownloadTokenAction } from "@/app/(main)/agent-download/actions";
import {
  buildLinuxAgentInstallCommand,
  buildLinuxStaticAgentInstallCommand,
  buildWindowsAgentInstallCommand,
  buildWindowsStaticAgentInstallCommand,
} from "@/lib/agent-install";

type AgentDownloadPanelProps = {
  facilityId: number;
  facilityName: string;
  requiresWorkGroup: boolean;
  workGroups: { id: number; workGroupName: string }[];
  staticInstallKey: string | null;
};

const INITIAL = { token: null as string | null, error: null as string | null, enrollmentName: null as string | null };

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

export function AgentDownloadPanel({ facilityId, facilityName, requiresWorkGroup, workGroups, staticInstallKey }: AgentDownloadPanelProps) {
  const [state, formAction, pending] = useActionState(
    createOfficerDownloadTokenAction,
    INITIAL
  );
  const [staticWorkGroupName, setStaticWorkGroupName] = useState("");

  const token = state.token;
  const staticWorkGroup = requiresWorkGroup ? staticWorkGroupName.trim() || "<WORK_GROUP_NAME>" : "";
  const staticWinCmd = buildWindowsStaticAgentInstallCommand({ facilityId, workGroupName: staticWorkGroup, installKey: staticInstallKey ?? undefined });
  const staticLinuxCmd = buildLinuxStaticAgentInstallCommand({ facilityId, workGroupName: staticWorkGroup, installKey: staticInstallKey ?? undefined });

  const winCmd = token ? buildWindowsAgentInstallCommand(token) : "";
  const linuxCmd = token ? buildLinuxAgentInstallCommand(token) : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-panel rounded-2xl px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">หน่วยงาน</p>
            <p className="mt-1 text-lg font-semibold">{facilityName}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {requiresWorkGroup ? "ต้องระบุชื่อกลุ่มงานก่อนสร้าง token" : "หน่วยงานนี้ไม่ต้องระบุกลุ่มงานตอนติดตั้ง agent"}
            </p>
          </div>
          {requiresWorkGroup ? (
            <Link
              href="/admin/settings/work-groups"
              className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
            >
              จัดการกลุ่มงาน
            </Link>
          ) : null}
        </div>
      </div>

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-sky-950">คำสั่งติดตั้งแบบใช้ซ้ำ</p>
            <p className="mt-1 text-sm text-sky-800">
              ใช้กับรหัสติดตั้งกลางจากผู้ดูแลระบบ แก้เฉพาะชื่อกลุ่มงานก่อนนำไปติดตั้งเครื่องปลายทาง
            </p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 font-mono text-xs text-sky-900">
            facilityId={facilityId}
          </div>
        </div>

        {requiresWorkGroup && (
          <div className="mt-4">
            <label htmlFor="staticWorkGroupName" className="block text-sm font-semibold text-sky-950">
              ชื่อกลุ่มงานในคำสั่ง
            </label>
            <input
              id="staticWorkGroupName"
              value={staticWorkGroupName}
              onChange={(event) => setStaticWorkGroupName(event.target.value)}
              list="static-facility-work-groups"
              maxLength={150}
              placeholder="เช่น กลุ่มงานไอที / OPD / งานการเงิน"
              className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-sky-950 outline-none transition focus:border-[var(--accent)]"
            />
            <datalist id="static-facility-work-groups">
              {workGroups.map((group) => (
                <option key={group.id} value={group.workGroupName} />
              ))}
            </datalist>
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-sky-200 bg-white/90 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-sky-950">Windows PowerShell</p>
              <CopyButton text={staticWinCmd} label="คัดลอกคำสั่ง" />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-sky-100">
              {staticWinCmd}
            </div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white/90 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-sky-950">Linux Terminal</p>
              <CopyButton text={staticLinuxCmd} label="คัดลอกคำสั่ง" />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-sky-100">
              {staticLinuxCmd}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-sky-800">
          {staticInstallKey
            ? "คำสั่งนี้ใส่ INSTALL_KEY จาก server ให้แล้ว ใช้คัดลอกไปติดตั้งได้ทันที"
            : "ยังไม่ได้ตั้งค่า ATACS_AGENT_INSTALL_KEY บน server คำสั่งจะแสดง <INSTALL_KEY> ไว้ให้แทนค่าภายหลัง"}
        </p>
      </div>

      {!token ? (
        <div className="glass-panel rounded-2xl px-5 py-6 text-center">
          <form action={formAction} className="mx-auto flex max-w-xl flex-col gap-4 text-left">
            {requiresWorkGroup && (
              <div>
                <label htmlFor="workGroupName" className="block text-sm font-semibold text-[var(--foreground)]">
                  ชื่อกลุ่มงาน
                </label>
                <input
                  id="workGroupName"
                  name="workGroupName"
                  list="facility-work-groups"
                  required
                  maxLength={150}
                  placeholder="เช่น กลุ่มงานไอที / OPD / งานการเงิน"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
                />
                <datalist id="facility-work-groups">
                  {workGroups.map((group) => (
                    <option key={group.id} value={group.workGroupName} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  ระบบจะบันทึกชื่อกลุ่มงานนี้ผูกกับหน่วยงาน{facilityName} และนำไปแสดงกับ token ติดตั้ง agent
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={pending}
              className="self-center rounded-full bg-[var(--accent-strong)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "กำลังสร้าง token…" : "สร้าง Enrollment Token"}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold">Enrollment Token</p>
                {state.enrollmentName && <p className="mt-0.5 text-xs text-[var(--muted)]">{state.enrollmentName}</p>}
              </div>
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
                <p className="font-semibold text-emerald-950">ติดตั้งบน Windows</p>
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

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-sky-950">ติดตั้งบน Linux</p>
                <p className="mt-1 text-sm text-sky-800">
                  วางคำสั่งนี้ใน Terminal เครื่องปลายทาง ระบบจะดาวน์โหลด agent และติดตั้งผ่าน sudo ให้อัตโนมัติ
                </p>
              </div>
              <CopyButton text={linuxCmd} label="คัดลอกคำสั่ง" />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl bg-stone-950 px-4 py-3 font-mono text-[11px] leading-5 text-sky-100">
              {linuxCmd}
            </div>
            <p className="mt-2 text-xs text-sky-800">รองรับทั้งเครื่องที่มี curl และเครื่องที่ใช้ wget</p>
          </div>

          <div className="glass-panel rounded-2xl px-5 py-4 text-center">
            <form action={formAction}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                disabled={pending}
                className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
              >
                สร้าง token ใหม่
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
