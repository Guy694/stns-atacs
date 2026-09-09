"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  createAgentEnrollmentAction,
} from "@/app/(main)/admin/settings/agent/actions";
import { agentEnrollmentInitialState } from "@/app/(main)/admin/settings/agent/types";
import {
  buildLinuxAgentInstallCommand,
  buildLinuxStaticAgentInstallCommand,
  buildWindowsAgentInstallCommand,
  buildWindowsStaticAgentInstallCommand,
} from "@/lib/agent-install";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
  typecode: string;
};

type WorkGroupOption = {
  id: number;
  facilityId: number;
  workGroupName: string;
};

type AgentEnrollmentPanelProps = {
  facilities: FacilityOption[];
  workGroups: WorkGroupOption[];
  staticInstallKey: string | null;
};

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
      className="shrink-0 rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white"
    >
      {copied ? "คัดลอกแล้ว" : label}
    </button>
  );
}

function requiresWorkGroup(typecode: string | null | undefined) {
  const code = (typecode ?? "").trim();
  if (code === "สสจ." || code === "สสจ") return true;
  if (code === "สสอ." || code === "สสอ") return true;
  if (code === "รพ.สต." || code === "รพ.สต") return false;
  return code.startsWith("รพ.");
}

export function AgentEnrollmentPanel({ facilities, workGroups, staticInstallKey }: AgentEnrollmentPanelProps) {
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [facilityLabel, setFacilityLabel] = useState("");
  const [workGroupId, setWorkGroupId] = useState("");
  const [state, formAction, pending] = useActionState(createAgentEnrollmentAction, agentEnrollmentInitialState);
  const facilitiesRef = useRef(facilities);
  const windowsInstallCommand = state.createdToken ? buildWindowsAgentInstallCommand(state.createdToken) : "";
  const linuxInstallCommand = state.createdToken ? buildLinuxAgentInstallCommand(state.createdToken) : "";
  const selectedFacility = facilities.find((item) => String(item.id) === selectedFacilityId);
  const selectedRequiresWorkGroup = requiresWorkGroup(selectedFacility?.typecode);
  const selectedWorkGroups = workGroups.filter((group) => String(group.facilityId) === selectedFacilityId);
  const staticWorkGroupId = selectedRequiresWorkGroup ? workGroupId || 0 : 0;
  const staticWindowsCommand = selectedFacility
    ? buildWindowsStaticAgentInstallCommand({ facilityId: selectedFacility.id, workGroupId: staticWorkGroupId, installKey: staticInstallKey ?? undefined })
    : "";
  const staticLinuxCommand = selectedFacility
    ? buildLinuxStaticAgentInstallCommand({ facilityId: selectedFacility.id, workGroupId: staticWorkGroupId, installKey: staticInstallKey ?? undefined })
    : "";

  useEffect(() => {
    facilitiesRef.current = facilities;
  }, [facilities]);

  useEffect(() => {
    const facility = facilitiesRef.current.find((item) => String(item.id) === selectedFacilityId);
    setFacilityLabel(
      facility ? `${facility.facility_name}${facility.district_name ? ` · อ.${facility.district_name}` : ""}` : ""
    );
  }, [selectedFacilityId]);

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Enrollment</p>
          <h2 className="section-title mt-1 text-xl font-semibold">สร้าง token สำหรับติดตั้ง Agent</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">หนึ่ง token ผูกกับหนึ่งหน่วยงานเสมอ เพื่อระบุว่าเครื่องที่ติดตั้งอยู่ในหน่วยงานใด</p>
        </div>
      </div>

      <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_auto]">
        <div>
          <label className="block text-sm font-medium">หน่วยงาน</label>
          <select
            name="facilityId"
            value={selectedFacilityId}
            onChange={(event) => {
              setSelectedFacilityId(event.target.value);
              setWorkGroupId("");
            }}
            required
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">— เลือกหน่วยงาน —</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.facility_name} {facility.district_name ? `· อ.${facility.district_name}` : ""}
              </option>
            ))}
          </select>
          <input type="hidden" name="facilityLabel" value={facilityLabel} />
        </div>

        <div>
          <label className="block text-sm font-medium">ชื่อกลุ่มงาน</label>
          <select
            name="workGroupId"
            value={workGroupId}
            onChange={(event) => setWorkGroupId(event.target.value)}
            required={selectedRequiresWorkGroup}
            disabled={!selectedFacilityId || !selectedRequiresWorkGroup}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:bg-stone-100 disabled:text-[var(--muted)]"
          >
            <option value="">
              {selectedRequiresWorkGroup
                ? selectedWorkGroups.length > 0
                  ? "เลือกกลุ่มงาน"
                  : "ยังไม่มีกลุ่มงานในหน่วยงานนี้"
                : "รพ.สต. ไม่ต้องระบุ"}
            </option>
            {selectedWorkGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.workGroupName}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedRequiresWorkGroup
              ? "เลือกจากกลุ่มงานที่มีอยู่แล้ว ระบบจะไม่สร้างชื่อกลุ่มงานใหม่จากการติดตั้ง agent"
              : "หน่วยงานประเภท รพ.สต. สร้าง token โดยใช้ชื่อหน่วยงานได้เลย"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">หมดอายุ</label>
          <input
            type="datetime-local"
            name="expiresAt"
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="lg:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={pending || !selectedFacilityId}
            className="rounded-xl bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "กำลังสร้าง…" : "สร้าง token"}
          </button>
        </div>
      </form>

      {selectedFacility && (
        <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-950">คำสั่งติดตั้งแบบใช้ซ้ำ</p>
              <p className="mt-1 text-xs text-sky-800">
                ใช้เมื่อต้องการให้ผู้ติดตั้งเลือกชื่อกลุ่มงานจากรายการเดิม โดยไม่ต้องสร้าง token จากหน้านี้ทุกครั้ง
              </p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 font-mono text-xs text-sky-900">
              facilityId={selectedFacility.id}
            </div>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-sky-200 bg-white/90 px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-sky-950">Windows PowerShell</p>
                <CopyButton text={staticWindowsCommand} label="คัดลอกคำสั่ง" />
              </div>
              <div className="mt-3 max-h-32 overflow-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-sky-100">
                {staticWindowsCommand}
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white/90 px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-sky-950">Linux Terminal</p>
                <CopyButton text={staticLinuxCommand} label="คัดลอกคำสั่ง" />
              </div>
              <div className="mt-3 max-h-32 overflow-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-sky-100">
                {staticLinuxCommand}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-sky-800">
            {staticInstallKey
              ? "คำสั่งนี้ใส่ INSTALL_KEY จาก server ให้แล้ว ใช้คัดลอกไปติดตั้งได้ทันที"
              : "ยังไม่ได้ตั้งค่า ATACS_AGENT_INSTALL_KEY บน server คำสั่งจะแสดง <INSTALL_KEY> ไว้ให้แทนค่าภายหลัง"}
          </p>
        </div>
      )}

      {state.error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</div>
      )}

      {state.createdToken && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">สร้าง token สำเร็จ{state.facilityName ? ` · ${state.facilityName}` : ""}</p>
          <p className="mt-1 text-xs text-emerald-700">ค่านี้จะแสดงครั้งเดียว ควรส่งให้เจ้าหน้าที่หน่วยงานใช้ตอนติดตั้ง agent</p>
          <div className="mt-3 rounded-xl bg-white px-4 py-3 font-mono text-xs text-[var(--foreground)] shadow-sm">
            {state.createdToken}
          </div>
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-950">คำสั่งเดียวสำหรับ Windows PowerShell</p>
                <p className="mt-1 text-xs text-emerald-800">ให้ผู้ติดตั้งเปิด PowerShell แบบ Run as Administrator แล้ววางคำสั่งนี้ได้ทันที</p>
              </div>
              <CopyButton text={windowsInstallCommand} label="คัดลอกคำสั่ง" />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-emerald-200">
              {windowsInstallCommand}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-sky-200 bg-white/80 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-sky-950">คำสั่งเดียวสำหรับ Linux Terminal</p>
                <p className="mt-1 text-xs text-sky-800">ให้ผู้ติดตั้งวางใน Terminal เครื่องปลายทาง ระบบจะดาวน์โหลดและติดตั้งผ่าน sudo</p>
              </div>
              <CopyButton text={linuxInstallCommand} label="คัดลอกคำสั่ง" />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] leading-5 text-sky-100">
              {linuxInstallCommand}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
