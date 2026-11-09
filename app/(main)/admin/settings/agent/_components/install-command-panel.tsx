"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import type { InstallCommandAction, InstallOsChoice } from "@/app/(main)/admin/settings/agent/types";

export type InstallFacilityOption = {
  id: number;
  name: string;
  typecode?: string | null;
  districtName?: string | null;
  requiresWorkGroup: boolean;
};

export type InstallWorkGroupOption = { id: number; facilityId: number; workGroupName: string };

type Props = {
  facilities: InstallFacilityOption[];
  workGroups: InstallWorkGroupOption[];
  /** server action ที่ตรวจสิทธิ์ตามหน้าที่ใช้ (ตั้งค่าระบบ / ดาวน์โหลด Agent) */
  getCommand: InstallCommandAction;
  /** ลิงก์จัดการกลุ่มงาน แสดงเมื่อหน่วยงานต้องมีกลุ่มงานแต่ยังไม่มี */
  manageWorkGroupsHref?: string | null;
};

const OS_OPTIONS: { value: InstallOsChoice; label: string; help: string }[] = [
  { value: "windows", label: "Windows", help: "เปิด PowerShell แบบ Run as Administrator แล้ววางคำสั่ง ระบบจะดาวน์โหลดและติดตั้ง Agent ให้เอง" },
  { value: "linux", label: "Linux", help: "วางคำสั่งใน Terminal ของเครื่องปลายทาง (ต้องใช้สิทธิ์ sudo) รองรับทั้ง curl และ wget" },
];

type CommandState = { key: string; command: string } | { key: string; error: string } | null;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // http (ไม่ใช่ https) หรือเบราว์เซอร์ที่ปิด clipboard API: ใช้วิธีเลือกข้อความแทน
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** เลือกหน่วยงาน (+กลุ่มงาน) และระบบปฏิบัติการ → คัดลอกคำสั่งติดตั้ง Agent (ระบบสร้างรหัสเฉพาะหน่วยงานให้เองเบื้องหลัง) */
export function InstallCommandPanel({ facilities, workGroups, getCommand, manageWorkGroupsHref = null }: Props) {
  const fieldId = useId();
  const single = facilities.length === 1 ? facilities[0] : null;
  const [facilityId, setFacilityId] = useState(single ? String(single.id) : "");
  const [workGroupId, setWorkGroupId] = useState("");
  const [os, setOs] = useState<InstallOsChoice>("windows");
  const [result, setResult] = useState<CommandState>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const cache = useRef(new Map<string, string>());
  const latestKey = useRef("");

  const facility = facilities.find((item) => String(item.id) === facilityId) ?? null;
  const facilityWorkGroups = facility ? workGroups.filter((group) => group.facilityId === facility.id) : [];
  const needsWorkGroup = Boolean(facility?.requiresWorkGroup);
  const ready = Boolean(facility) && (!needsWorkGroup || Boolean(workGroupId));
  const requestKey = ready ? `${facilityId}:${needsWorkGroup ? workGroupId : 0}:${os}` : "";
  const current = result && result.key === requestKey ? result : null;
  const command = current && "command" in current ? current.command : null;
  const error = current && "error" in current ? current.error : null;
  const osOption = OS_OPTIONS.find((item) => item.value === os) ?? OS_OPTIONS[0];

  useEffect(() => {
    latestKey.current = requestKey;
    if (!requestKey) return;
    const cached = cache.current.get(requestKey);
    if (cached) {
      setResult({ key: requestKey, command: cached });
      return;
    }
    startTransition(async () => {
      let next: CommandState;
      try {
        const response = await getCommand({ facilityId: Number(facilityId), workGroupId: needsWorkGroup ? Number(workGroupId) : null, os });
        next = response.ok ? { key: requestKey, command: response.command } : { key: requestKey, error: response.error };
        if (response.ok) cache.current.set(requestKey, response.command);
      } catch {
        next = { key: requestKey, error: "สร้างคำสั่งไม่สำเร็จ กรุณาลองใหม่" };
      }
      if (latestKey.current === requestKey) setResult(next);
    });
  }, [requestKey, facilityId, workGroupId, needsWorkGroup, os, getCommand]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!command) return;
    if (await copyText(command)) setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <label htmlFor={`${fieldId}-facility`} className="block text-sm font-medium">หน่วยงาน</label>
          {single ? (
            <p id={`${fieldId}-facility`} className="mt-1 flex min-h-9 items-center rounded-[0.625rem] border border-[var(--line)] bg-white/70 px-3 text-[0.8125rem] font-medium">
              {single.name}
            </p>
          ) : (
            <div className="mt-1">
              <FacilitySelect
                id={`${fieldId}-facility`}
                facilities={facilities}
                value={facilityId}
                onChange={(value) => {
                  setFacilityId(value);
                  setWorkGroupId("");
                }}
                emptyLabel="— เลือกหน่วยงาน —"
                required
              />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${fieldId}-group`} className="block text-sm font-medium">กลุ่มงาน</label>
          {needsWorkGroup ? (
            <select
              id={`${fieldId}-group`}
              value={workGroupId}
              onChange={(event) => setWorkGroupId(event.target.value)}
              required
              disabled={facilityWorkGroups.length === 0}
              className="filter-control mt-1 w-full"
            >
              <option value="">{facilityWorkGroups.length > 0 ? "— เลือกกลุ่มงาน —" : "ยังไม่มีกลุ่มงานในหน่วยงานนี้"}</option>
              {facilityWorkGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.workGroupName}</option>
              ))}
            </select>
          ) : (
            <p id={`${fieldId}-group`} className="mt-1 flex min-h-9 items-center rounded-[0.625rem] border border-dashed border-[var(--line)] px-3 text-[0.8125rem] text-[var(--muted)]">
              {facility ? "หน่วยงานนี้ไม่ต้องระบุกลุ่มงาน" : "เลือกหน่วยงานก่อน"}
            </p>
          )}
          {needsWorkGroup && facilityWorkGroups.length === 0 && manageWorkGroupsHref ? (
            <Link href={manageWorkGroupsHref} className="mt-1 inline-flex text-xs font-medium text-[var(--accent-strong)] underline-offset-2 hover:underline">
              เพิ่มกลุ่มงานของหน่วยงานนี้
            </Link>
          ) : null}
        </div>

        <fieldset className="min-w-0 md:col-span-2 xl:col-span-1">
          <legend className="block text-sm font-medium">ระบบปฏิบัติการ</legend>
          <div className="mt-1 inline-flex rounded-[0.625rem] border border-[var(--line)] bg-white p-0.5" role="radiogroup" aria-label="ระบบปฏิบัติการ">
            {OS_OPTIONS.map((option) => {
              const active = option.value === os;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setOs(option.value)}
                  className={`inline-flex min-h-[30px] items-center gap-2 whitespace-nowrap rounded-lg px-4 text-[0.8125rem] font-medium transition ${
                    active ? "bg-[var(--accent-strong)] text-white shadow-sm" : "text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <AppIcon name={option.value === "windows" ? "monitor" : "database"} size={15} aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            คำสั่งติดตั้ง · {os === "windows" ? "Windows PowerShell" : "Linux Terminal"}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!command || pending}
            className="primary-action action-sm self-start sm:self-auto"
            aria-live="polite"
          >
            <AppIcon name={copied ? "check" : "copy"} size={16} aria-hidden="true" />
            {copied ? "คัดลอกแล้ว" : "คัดลอกคำสั่ง"}
          </button>
        </div>
        <div className="bg-[#0f2236] px-4 py-3">
          {command ? (
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-sky-100 selection:bg-sky-300/40">
              {command}
            </pre>
          ) : (
            <p className="py-3 text-sm text-sky-100/70" aria-live="polite">
              {pending
                ? "กำลังเตรียมคำสั่ง…"
                : !facility
                  ? "เลือกหน่วยงานเพื่อสร้างคำสั่งติดตั้ง"
                  : needsWorkGroup && !workGroupId
                    ? "เลือกกลุ่มงานเพื่อสร้างคำสั่งติดตั้ง"
                    : error
                      ? "สร้างคำสั่งไม่สำเร็จ"
                      : "กำลังเตรียมคำสั่ง…"}
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-2.5 text-sm text-[var(--state-danger-fg)]">
          {error}
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
        <AppIcon name="info" size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {osOption.help} · คำสั่งนี้ใช้ได้กับทุกเครื่องของหน่วยงาน{needsWorkGroup ? "/กลุ่มงาน" : ""}ที่เลือก จนกว่าจะยกเลิกรหัสติดตั้ง
        </span>
      </p>
    </div>
  );
}
