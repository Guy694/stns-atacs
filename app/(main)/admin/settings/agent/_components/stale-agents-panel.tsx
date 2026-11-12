"use client";

import { useState, useTransition } from "react";

import { retireStaleAgentsAction } from "@/app/(main)/admin/settings/agent/actions";
import { AppIcon } from "@/app/_components/ui/icon";
import { confirmAction } from "@/app/_components/ui/confirm";
import { toast } from "@/app/_components/ui/toast";
import { formatThaiDateTime } from "@/lib/date-format";

export type StaleAgentRow = {
  id: number;
  hostname: string | null;
  facilityName: string;
  agentVersion: string | null;
  lastContactAt: string;
  daysSilent: number;
  selfUninstall: boolean;
};

/** N6: เครื่องที่ไม่ส่งข้อมูลเกินเกณฑ์ — เลือกแล้วยืนยันเลิกใช้ทีเดียว */
export function StaleAgentsPanel({ rows, days }: { rows: StaleAgentRow[]; days: number }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(rows.map((row) => row.id)));
  const [pending, startTransition] = useTransition();
  if (rows.length === 0) return null;

  const allChecked = selected.size === rows.length;
  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function retire() {
    const ids = [...selected];
    const ok = await confirmAction({
      title: `ยืนยันเลิกใช้ ${ids.length} เครื่อง?`,
      text: "ระบบจะยกเลิกกุญแจของเครื่อง เลิกนับในสถานะออนไลน์/ออฟไลน์ และหยุดแจ้งเตือน · ประวัติและทะเบียนครุภัณฑ์ยังอยู่ · ถ้าเครื่องกลับมา Agent 2.2 ขึ้นไปจะถอนตัวเอง",
      confirmText: "ยืนยันเลิกใช้",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await retireStaleAgentsAction(ids);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <section aria-labelledby="stale-agents-heading" className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
        <div>
          <h2 id="stale-agents-heading" className="flex items-center gap-2 text-base font-semibold">
            <AppIcon name="power-off" size={18} className="text-[var(--state-warning-fg)]" /> เครื่องที่ไม่ส่งข้อมูลเกิน {days.toLocaleString("th-TH")} วัน ({rows.length.toLocaleString("th-TH")})
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">เครื่องเหล่านี้อาจจำหน่าย ย้าย หรือลงระบบใหม่ไปแล้ว — ถ้าเลิกใช้จริง ให้ยืนยันเพื่อหยุดนับและหยุดแจ้งเตือน</p>
        </div>
        <button type="button" onClick={retire} disabled={pending || selected.size === 0} aria-busy={pending} className="danger-action action-sm gap-1.5">
          <AppIcon name="power-off" size={14} /> {pending ? "กำลังดำเนินการ…" : `ยืนยันเลิกใช้ที่เลือก (${selected.size.toLocaleString("th-TH")})`}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมด"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)))}
                />
              </th>
              <th className="px-4 py-2.5 font-medium">เครื่อง</th>
              <th className="px-4 py-2.5 font-medium">หน่วยงาน</th>
              <th className="px-4 py-2.5 text-right font-medium">เงียบมา</th>
              <th className="px-4 py-2.5 font-medium">ติดต่อล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-2.5">
                  <input type="checkbox" aria-label={`เลือก ${row.hostname ?? row.id}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{row.hostname ?? `Device #${row.id}`}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Agent {row.agentVersion ?? "-"}
                    {!row.selfUninstall && " · ถ้ากลับมาต้องถอนด้วยมือ"}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-xs">{row.facilityName}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[var(--state-warning-fg)]">{row.daysSilent.toLocaleString("th-TH")} วัน</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--muted)]">{formatThaiDateTime(row.lastContactAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
