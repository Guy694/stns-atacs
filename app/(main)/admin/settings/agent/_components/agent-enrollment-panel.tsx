"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  createAgentEnrollmentAction,
} from "@/app/(main)/admin/settings/agent/actions";
import { agentEnrollmentInitialState } from "@/app/(main)/admin/settings/agent/types";
import { AGENT_INSTALL_API_BASE_URL } from "@/lib/agent-install";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
};

type AgentEnrollmentPanelProps = {
  facilities: FacilityOption[];
};

export function AgentEnrollmentPanel({ facilities }: AgentEnrollmentPanelProps) {
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [facilityLabel, setFacilityLabel] = useState("");
  const [state, formAction, pending] = useActionState(createAgentEnrollmentAction, agentEnrollmentInitialState);
  const facilitiesRef = useRef(facilities);

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
            onChange={(event) => setSelectedFacilityId(event.target.value)}
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
          <label className="block text-sm font-medium">ชื่อกำกับ token</label>
          <input
            name="enrollmentName"
            placeholder="เช่น เครื่องห้อง OPD / ติดตั้งรอบที่ 1"
            className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
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
          <div className="mt-3 rounded-xl border border-black/8 bg-white/70 px-4 py-3 text-xs text-[var(--muted)]">
            ติดตั้งฝั่งเครื่องตัวอย่าง:
            <div className="mt-2 overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 font-mono text-[11px] text-emerald-200">
              <div>Windows: powershell -ExecutionPolicy Bypass -File .\install-atacs-agent.ps1 -ApiBaseUrl {AGENT_INSTALL_API_BASE_URL} -EnrollmentToken {state.createdToken}</div>
              <div className="mt-1">Linux: sudo bash ./install-atacs-agent.sh --api-base-url {AGENT_INSTALL_API_BASE_URL} --enrollment-token {state.createdToken}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
