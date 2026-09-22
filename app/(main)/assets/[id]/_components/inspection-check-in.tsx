import Link from "next/link";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { updateInspectionItemAction } from "@/app/(main)/inspection/actions";
import { assetStatusLabel } from "@/lib/asset-status";
import { formatThaiDateTime } from "@/lib/date-format";
import type { OpenInspectionForAsset } from "@/lib/inspection";

const OPTIONS = [
  { value: "Active", label: "พบ · ใช้งานได้", className: "bg-emerald-600 text-white hover:bg-emerald-700" },
  { value: "Broken", label: "พบ · ชำรุด", className: "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50" },
  { value: "Inactive", label: "พบ · ไม่ใช้งาน", className: "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50" },
];

/** One-tap check-in shown on the asset page (the page a scanned QR opens) while a round is open. */
type Placement = {
  facilityName: string;
  workGroupId: number | null;
  workGroupName: string;
  locationDetail: string;
  workGroups: Array<{ id: number; workGroupName: string }>;
};

export function InspectionCheckIn({ assetId, rounds, justChecked, placement }: { assetId: number; rounds: OpenInspectionForAsset[]; justChecked?: number; placement: Placement }) {
  // The registered group stays selectable even if it has been deactivated since.
  const groups = placement.workGroupId && !placement.workGroups.some((group) => group.id === placement.workGroupId)
    ? [{ id: placement.workGroupId, workGroupName: placement.workGroupName || `กลุ่มงาน #${placement.workGroupId}` }, ...placement.workGroups]
    : placement.workGroups;
  const field = "mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)]";
  return (
    <section aria-labelledby="check-in-heading" className="rounded-2xl border-2 border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] p-4 sm:p-5">
      <h2 id="check-in-heading" className="text-base font-semibold text-[var(--foreground)]">ตรวจนับครุภัณฑ์นี้</h2>
      <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-xl bg-white/70 px-3 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-[var(--muted)]">หน่วยงานในทะเบียน</dt>
        <dd className="font-medium">{placement.facilityName || "-"}</dd>
        <dt className="text-[var(--muted)]">กลุ่มงานในทะเบียน</dt>
        <dd className="font-medium">{placement.workGroupName || "ไม่ระบุกลุ่มงาน"}{placement.locationDetail ? <span className="font-normal text-[var(--muted)]"> · {placement.locationDetail}</span> : null}</dd>
      </dl>
      {rounds.map((round) => {
        const done = round.inspectionStatus !== "Pending";
        return (
          <form key={round.itemId} action={updateInspectionItemAction} className="mt-3 space-y-3 rounded-xl bg-white p-3">
            <input type="hidden" name="itemId" value={round.itemId} />
            <input type="hidden" name="inspectionStatus" value="Found" />
            <input type="hidden" name="returnTo" value={`/assets/${assetId}`} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/inspection/${round.inspectionId}`} className="text-sm font-semibold text-[var(--primary-text)] hover:underline">{round.roundName}</Link>
              {done ? (
                <StatusBadge tone={round.inspectionStatus === "Missing" ? "danger" : "success"}>
                  {round.inspectionStatus === "Missing" ? "บันทึกว่าไม่พบ" : `ตรวจแล้ว · ${assetStatusLabel(round.assetStatus)}`}
                </StatusBadge>
              ) : (
                <StatusBadge tone="warning">รอตรวจ</StatusBadge>
              )}
            </div>
            {justChecked === round.inspectionId && <p role="status" className="text-sm font-medium text-[#006300]">บันทึกผลตรวจแล้ว</p>}
            {done && round.checkedAt && <p className="text-xs text-[var(--muted)]">ตรวจล่าสุด {formatThaiDateTime(round.checkedAt)}{round.checkedBy ? ` โดย ${round.checkedBy}` : ""} · กดอีกครั้งเพื่อแก้ไข</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-[var(--muted)]">พบที่กลุ่มงาน
                <select name="foundWorkGroupId" defaultValue={String(round.foundWorkGroupId ?? placement.workGroupId ?? "")} className={field}>
                  <option value="">ไม่ระบุกลุ่มงาน</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.workGroupName}{group.id === placement.workGroupId ? " (ตามทะเบียน)" : ""}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--muted)]">ที่ตั้งที่พบ (กรอกเมื่อต่างจากทะเบียน)
                <input name="foundLocation" maxLength={255} defaultValue={round.foundLocation} className={field} placeholder={placement.locationDetail || "เช่น ห้อง 205 ชั้น 2"} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" name="updateRegistry" value="1" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
              <span>ถ้าพบต่างจากทะเบียน ให้ปรับกลุ่มงาน/ที่ตั้งในทะเบียนเป็นที่พบด้วย (ถ้าไม่เลือก ระบบบันทึกไว้ในรายงานผลตรวจเท่านั้น)</span>
            </label>
            <label className="block text-xs text-[var(--muted)]">หมายเหตุ / สภาพ (ไม่บังคับ)
              <input name="conditionNote" maxLength={255} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--foreground)]" placeholder="เช่น จอมีรอยแตก" />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {OPTIONS.map((option) => (
                <button key={option.value} name="assetStatus" value={option.value} className={`min-h-12 rounded-xl px-3 text-sm font-semibold transition ${option.className}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </form>
        );
      })}
    </section>
  );
}
