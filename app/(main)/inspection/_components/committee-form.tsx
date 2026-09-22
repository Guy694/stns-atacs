"use client";

import { useActionState } from "react";

import { saveCommitteeAction } from "@/app/(main)/inspection/actions";

type Member = { seq: number; role: "chair" | "member"; fullName: string; position: string };
const ROLE_LABELS = { chair: "ประธานกรรมการ", member: "กรรมการ" } as const;
const SLOTS = 4;

/** Committee printed as the signature block on the count sheet (chair + 3 members). */
export function CommitteeForm({ inspectionId, members, canEdit }: { inspectionId: number; members: Member[]; canEdit: boolean }) {
  const [result, formAction, pending] = useActionState(saveCommitteeAction, null);

  if (!canEdit) {
    return members.length === 0 ? (
      <p className="text-sm text-[var(--muted)]">ยังไม่ได้กำหนดคณะกรรมการ</p>
    ) : (
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {members.map((member) => (
          <div key={member.seq}>
            <dt className="text-xs text-[var(--muted)]">{ROLE_LABELS[member.role]}</dt>
            <dd>{member.fullName}{member.position ? <span className="text-[var(--muted)]"> · {member.position}</span> : null}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <p className="text-xs text-[var(--muted)]">เลือกประธานกรรมการ 1 คน ที่เหลือเป็นกรรมการ แถวที่ไม่กรอกชื่อจะไม่ถูกบันทึก</p>
      {Array.from({ length: SLOTS }, (_, index) => {
        const member = members[index];
        const defaultRole = member?.role ?? (index === 0 ? "chair" : "member");
        return (
          <CommitteeRow key={index} index={index} defaultRole={defaultRole} defaultName={member?.fullName ?? ""} defaultPosition={member?.position ?? ""} />
        );
      })}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {pending ? "กำลังบันทึก…" : "บันทึกคณะกรรมการ"}
        </button>
        <span role="status" className={`text-sm ${result && result !== "saved" ? "text-rose-700" : "text-[#006300]"}`}>
          {result === "saved" ? "บันทึกแล้ว" : result}
        </span>
      </div>
    </form>
  );
}

/** One committee row: role dropdown + name + position. Field names match readCommittee() on the server. */
export function CommitteeRow({ index, defaultRole, defaultName = "", defaultPosition = "" }: { index: number; defaultRole: "chair" | "member"; defaultName?: string; defaultPosition?: string }) {
  const n = index + 1;
  const field = "min-h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm";
  return (
    <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <select name={`committeeRole${n}`} defaultValue={defaultRole} aria-label={`ตำแหน่งในคณะกรรมการ ลำดับ ${n}`} className={field}>
        <option value="chair">ประธานกรรมการ</option>
        <option value="member">กรรมการ</option>
      </select>
      <input name={`committeeName${n}`} defaultValue={defaultName} aria-label={`ชื่อ-นามสกุล ลำดับ ${n}`} placeholder="ชื่อ-นามสกุล" maxLength={255} className={field} />
      <input name={`committeePosition${n}`} defaultValue={defaultPosition} aria-label={`ตำแหน่งงาน ลำดับ ${n}`} placeholder="ตำแหน่ง" maxLength={255} className={field} />
    </div>
  );
}
