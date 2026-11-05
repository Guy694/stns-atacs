import { updateAgentAutoUpdateAction } from "@/app/(main)/admin/settings/agent/actions";
import { SubmitButton } from "@/app/_components/ui/submit-button";
import {
  AGENT_SELF_UPDATE_MIN_VERSION,
  type AgentAutoUpdateSettings,
  type AgentUpdateFleetSummary,
} from "@/lib/agent-update";

type FacilityOption = { id: number; facility_name: string; district_name: string | null };

type Props = {
  settings: AgentAutoUpdateSettings;
  summary: AgentUpdateFleetSummary;
  latestVersion: string;
  facilities: FacilityOption[];
  notice: string | null;
  error: string | null;
};

const MODES: { value: AgentAutoUpdateSettings["mode"]; label: string; detail: string }[] = [
  { value: "off", label: "ปิด", detail: "ไม่แจกรุ่นใหม่ให้เครื่องใด (ค่าเริ่มต้น)" },
  { value: "pilot", label: "นำร่องบางหน่วยงาน", detail: "อัปเดตเฉพาะหน่วยงานที่เลือกด้านล่าง" },
  { value: "all", label: "ทุกหน่วยงาน", detail: "เครื่องที่รองรับทุกเครื่องอัปเดตในรอบรายงานถัดไป" },
];

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

export function AgentAutoUpdateCard({ settings, summary, latestVersion, facilities, notice, error }: Props) {
  const pilot = new Set(settings.pilotFacilityIds);
  return (
    <section className="glass-panel overflow-hidden rounded-2xl">
      <div className="border-b border-black/6 px-5 py-4">
        <h2 className="text-lg font-semibold">อัปเดต Agent อัตโนมัติ</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          รุ่นล่าสุดบนเซิร์ฟเวอร์ <span className="font-mono font-semibold text-[var(--foreground)]">{latestVersion}</span> · Agent
          ตั้งแต่รุ่น {AGENT_SELF_UPDATE_MIN_VERSION} ดาวน์โหลดรุ่นใหม่เองหลังส่งรายงานสำเร็จ (ตรวจ https, ชื่อเซิร์ฟเวอร์,
          ขนาดไฟล์ และ SHA-256 ก่อนแทนที่ เก็บไฟล์เดิมไว้เป็น .bak) แล้วใช้รุ่นใหม่ในรอบถัดไป (ประมาณทุก 4 ชั่วโมง)
        </p>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="รุ่นล่าสุดแล้ว" value={summary.upToDate} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            <Stat label="จะอัปเดตเอง" value={summary.autoUpdating} tone="border-sky-200 bg-sky-50 text-sky-800" />
            <Stat label="รองรับ แต่ยังไม่เปิด" value={summary.updaterWaiting} tone="border-stone-200 bg-stone-50 text-stone-700" />
            <Stat label="ต้องติดตั้งใหม่ 1 ครั้ง" value={summary.needsReinstall} tone="border-amber-200 bg-amber-50 text-amber-800" />
          </div>
          {summary.needsReinstall > 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              เครื่องที่ใช้ Agent ก่อนรุ่น {AGENT_SELF_UPDATE_MIN_VERSION} ยังไม่มีตัวอัปเดตอัตโนมัติ ต้องรันคำสั่งติดตั้งด้านบนซ้ำบนเครื่องนั้น
              หนึ่งครั้ง (เครื่องเดิมยังใช้ทะเบียนเดิม ไม่เกิดเครื่องซ้ำ) หลังจากนั้นจะอัปเดตเองตามการตั้งค่านี้
            </p>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-black/6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                  <th className="px-4 py-2 text-left font-medium">รุ่น Agent</th>
                  <th className="px-4 py-2 text-right font-medium">จำนวนเครื่อง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {summary.versions.map((row) => (
                  <tr key={row.version}>
                    <td className="px-4 py-2 font-mono">{row.version}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.count.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
                {summary.versions.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-[var(--muted)]">ยังไม่มีเครื่องที่ใช้งานอยู่</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <form action={updateAgentAutoUpdateAction} className="flex flex-col gap-4">
          {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p> : null}
          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">โหมดการอัปเดต</legend>
            {MODES.map((mode) => (
              <label key={mode.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 bg-white/70 px-4 py-2.5 text-sm hover:bg-white">
                <input type="radio" name="mode" value={mode.value} defaultChecked={settings.mode === mode.value} className="mt-1" />
                <span>
                  <span className="font-medium">{mode.label}</span>
                  <span className="block text-xs text-[var(--muted)]">{mode.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">
              หน่วยงานนำร่อง <span className="font-normal text-[var(--muted)]">(ใช้เมื่อเลือก “นำร่องบางหน่วยงาน” · เลือกแล้ว {pilot.size.toLocaleString("th-TH")} แห่ง)</span>
            </legend>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-black/8 bg-white/70 p-2">
              {facilities.map((facility) => (
                <label key={facility.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                  <input type="checkbox" name="pilotFacilityIds" value={facility.id} defaultChecked={pilot.has(facility.id)} />
                  <span>{facility.facility_name}</span>
                  {facility.district_name ? <span className="text-xs text-[var(--muted)]">· {facility.district_name}</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-[var(--muted)]">
            ย้อนกลับรุ่นด้วยมือ: Windows คัดลอก <span className="font-mono">%ProgramData%\ATACSAgent\atacs-agent.ps1.bak</span> ทับ{" "}
            <span className="font-mono">atacs-agent.ps1</span> · Linux คัดลอก <span className="font-mono">/opt/atacs-agent/atacs-agent.py.bak</span> ทับ{" "}
            <span className="font-mono">atacs-agent.py</span> แล้วตั้งโหมดเป็น “ปิด” เพื่อไม่ให้อัปเดตซ้ำ
          </p>
          <div>
            <SubmitButton
              pendingText="กำลังบันทึก…"
              className="rounded-xl bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              บันทึกการตั้งค่าอัปเดต
            </SubmitButton>
          </div>
        </form>
      </div>
    </section>
  );
}
