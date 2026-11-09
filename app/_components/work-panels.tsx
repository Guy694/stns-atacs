import Link from "next/link";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { numberFormat, percent } from "@/app/_components/overview-format";
import { formatThaiDate } from "@/lib/date-format";
import type { WorkQueue } from "@/lib/dashboard-work";
import { DEADLINE_LABELS, PROGRESS_STAGE_LABELS, type InspectionProgressSummary, type ProgressStage } from "@/lib/inspection-progress";

// Progress colours: done (green), in a round but not yet checked (light blue), not in any round (track).
const CHECKED = "#0ca30c";
const COVERED = "#86b6ef";
const TRACK = "#eef3f8";

const STAGE_TONES: Record<ProgressStage, "success" | "warning" | "danger" | "info" | "neutral"> = {
  closed: "success",
  checked: "info",
  "in-progress": "warning",
  partial: "warning",
  // "Not opened" is a normal state early in the fiscal year, so it stays neutral rather than red.
  "not-started": "neutral",
};

type Progress = InspectionProgressSummary & { fiscalYear: number; schemaReady: boolean };

function ProgressBar({ checked, covered, total, label }: { checked: number; covered: number; total: number; label: string }) {
  const width = (value: number) => `${total ? Math.min(100, (value / total) * 100) : 0}%`;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: TRACK }} role="img" aria-label={label}>
      <span style={{ width: width(checked), background: CHECKED }} />
      <span style={{ width: width(Math.max(0, covered - checked)), background: COVERED }} />
    </div>
  );
}

type ProgressRow = Progress["facilities"][number];

function FacilityProgressList({ rows, coverageHref }: { rows: ProgressRow[]; coverageHref: (facilityId?: number) => string }) {
  return (
    <ul className="divide-y divide-[var(--line)]">
      {rows.map((row) => (
        <li key={row.facilityId} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <div className="min-w-0">
            <Link href={coverageHref(row.facilityId)} className="block truncate text-sm font-medium text-[var(--foreground)] hover:underline">{row.facilityName}</Link>
            <p className="text-xs text-[var(--muted)]">{row.districtName ? `อ.${row.districtName} · ` : ""}{numberFormat.format(row.assets)} รายการ</p>
          </div>
          <ProgressBar checked={row.checked} covered={row.covered} total={row.assets}
            label={`${row.facilityName}: ตรวจแล้ว ${row.checked} อยู่ในรอบ ${row.covered} จาก ${row.assets} รายการ`} />
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{percent(row.checkedRate)}</span>
            <StatusBadge tone={STAGE_TONES[row.stage]}>{PROGRESS_STAGE_LABELS[row.stage]}</StatusBadge>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Facilities that need attention now: a round is open, or a closed round left items unchecked. */
const NEEDS_ATTENTION: ProgressStage[] = ["in-progress", "checked", "partial"];

/**
 * `variant="summary"` (dashboard): collapses to one card when no round has started in the fiscal year,
 * otherwise lists facilities needing attention first and tucks the rest into a native expander.
 * `variant="full"` (coverage page): every row up to `limit`.
 */
export function InspectionProgressPanel({ progress, coverageHref, limit = 12, variant = "full", newRoundHref }: {
  progress: Progress;
  coverageHref: (facilityId?: number) => string;
  limit?: number;
  variant?: "full" | "summary";
  /** Shown on the "no round yet" card only; pass it only when the user may create rounds. */
  newRoundHref?: string;
}) {
  const { totals, facilities, stageCounts } = progress;
  if (!progress.schemaReady) {
    return <p className="text-sm text-[var(--muted)]">ยังไม่มีตารางตรวจนับในฐานข้อมูล</p>;
  }
  if (!facilities.length) {
    return <p className="text-sm text-[var(--muted)]">ยังไม่มีครุภัณฑ์ในขอบเขตที่เลือก</p>;
  }
  const summary = variant === "summary";

  if (summary && stageCounts["not-started"] === facilities.length) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--state-neutral-border)] bg-[var(--state-neutral-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AppIcon name="clipboard-check" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--state-neutral-fg)]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">ยังไม่เปิดรอบตรวจนับปีงบ {progress.fiscalYear}</p>
            <p className="mt-0.5 text-xs text-[var(--state-neutral-fg)]">
              {numberFormat.format(facilities.length)} หน่วยงาน · ครุภัณฑ์ {numberFormat.format(totals.assets)} รายการยังไม่อยู่ในรอบตรวจนับ ·{" "}
              <Link href={coverageHref()} className="text-[var(--primary-text)] underline">ดูรายหน่วยงาน</Link>
            </p>
          </div>
        </div>
        {newRoundHref && (
          <Link href={newRoundHref} className="primary-action shrink-0">
            <AppIcon name="clipboard-check" className="h-4 w-4" /> เริ่มรอบตรวจนับใหม่
          </Link>
        )}
      </div>
    );
  }

  const priority = summary ? facilities.filter((row) => NEEDS_ATTENTION.includes(row.stage)) : facilities;
  const shown = priority.slice(0, limit);
  const shownIds = new Set(shown.map((row) => row.facilityId));
  const rest = summary ? facilities.filter((row) => !shownIds.has(row.facilityId)) : [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">ตรวจแล้ว</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{percent(totals.checkedRate)}</p>
          <p className="text-xs text-[var(--muted)]">{numberFormat.format(totals.checked)} จาก {numberFormat.format(totals.assets)} รายการ</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">อยู่ในรอบตรวจแล้ว</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{percent(totals.coverageRate)}</p>
          <p className="text-xs text-[var(--muted)]">พบ {numberFormat.format(totals.found)} · ไม่พบ {numberFormat.format(totals.missing)}</p>
        </div>
        <Link href={coverageHref()} className="rounded-xl border border-[var(--line)] p-3 transition hover:bg-[var(--primary-soft)]">
          <p className="text-xs text-[var(--muted)]">ยังไม่อยู่ในรอบใดเลย</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${totals.uncovered ? "text-[var(--state-warning-fg)]" : ""}`}>{numberFormat.format(totals.uncovered)}</p>
          <p className="inline-flex items-center gap-1 text-xs text-[var(--primary-text)] underline">ดูรายการ <AppIcon name="chevron-right" className="h-3.5 w-3.5" /></p>
        </Link>
        <div className="rounded-xl border border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">หน่วยงาน</p>
          <p className="mt-1 text-sm leading-6">
            ปิดรอบครบ <b className="tabular-nums">{numberFormat.format(stageCounts.closed)}</b> · กำลังตรวจ <b className="tabular-nums">{numberFormat.format(stageCounts["in-progress"] + stageCounts.checked)}</b>
            <br />ยังไม่เปิดรอบ <b className="tabular-nums">{numberFormat.format(stageCounts["not-started"])}</b>{stageCounts.partial ? <> · ตกหล่น <b className="tabular-nums">{numberFormat.format(stageCounts.partial)}</b></> : null}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: CHECKED }} /> ตรวจแล้ว</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: COVERED }} /> อยู่ในรอบ ยังไม่ตรวจ</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-[var(--line)]" style={{ background: TRACK }} /> ยังไม่อยู่ในรอบ</span>
          <span className="sm:ml-auto">{summary ? "หน่วยงานที่กำลังตรวจนับหรือค้างตรวจ" : "เรียงจากความคืบหน้าน้อยที่สุด"}</span>
        </div>
        {shown.length > 0
          ? <FacilityProgressList rows={shown} coverageHref={coverageHref} />
          : <p className="py-2 text-sm text-[var(--muted)]">ไม่มีหน่วยงานที่กำลังตรวจนับหรือค้างตรวจ</p>}
        {rest.length > 0 && (
          <details className="group mt-1 border-t border-[var(--line)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-[var(--primary-text)] hover:underline [&::-webkit-details-marker]:hidden">
              <AppIcon name="chevron-down" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
              <span className="group-open:hidden">ดูทั้งหมด ({numberFormat.format(rest.length)})</span>
              <span className="hidden group-open:inline">ซ่อนหน่วยงานอื่น ({numberFormat.format(rest.length)})</span>
            </summary>
            <FacilityProgressList rows={rest} coverageHref={coverageHref} />
          </details>
        )}
        {!summary && facilities.length > shown.length && (
          <p className="mt-2 text-xs text-[var(--muted)]">แสดง {numberFormat.format(shown.length)} จาก {numberFormat.format(facilities.length)} หน่วยงาน · <Link href={coverageHref()} className="text-[var(--primary-text)] underline">ดูทั้งหมด</Link></p>
        )}
      </div>
    </div>
  );
}

function QueueItem({ href, icon, label, count, detail, urgent }: { href: string; icon: IconName; label: string; count: number; detail?: string; urgent?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2 transition hover:bg-[var(--primary-soft)]">
        <AppIcon name={icon} className="h-4 w-4 shrink-0 text-[var(--primary-text)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--foreground)]">{label}</span>
          {detail && <span className={`block text-xs ${urgent ? "text-[var(--state-danger-fg)]" : "text-[var(--muted)]"}`}>{detail}</span>}
        </span>
        <span className={`text-lg font-bold tabular-nums ${count ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{numberFormat.format(count)}</span>
      </Link>
    </li>
  );
}

export function WorkQueuePanel({ queue }: { queue: WorkQueue }) {
  const overdue = queue.openRounds.filter((round) => round.state === "overdue").length;
  const dueSoon = queue.openRounds.filter((round) => round.state === "due-soon").length;
  const urgentRounds = queue.openRounds.filter((round) => round.state === "overdue" || round.state === "due-soon").slice(0, 5);
  const items: Array<{ href: string; icon: IconName; label: string; count: number; detail?: string; urgent?: boolean }> = [
    { href: "/disposal", icon: "archive", label: "คำขอจำหน่าย/สูญหายรออนุมัติ", count: queue.pendingDisposals },
    { href: "/disposal#awaiting-execution", icon: "file-text", label: "อนุมัติแล้ว รอบันทึกผลการจำหน่าย", count: queue.awaitingExecution },
    { href: "/repairs", icon: "wrench", label: "งานซ่อมที่ยังไม่ปิด", count: queue.openRepairs, detail: queue.urgentRepairs ? `เร่งด่วน/สูง ${numberFormat.format(queue.urgentRepairs)} งาน` : undefined, urgent: queue.urgentRepairs > 0 },
    { href: "/inspection", icon: "clipboard-check", label: "รอบตรวจนับที่ยังเปิดอยู่", count: queue.openRounds.length,
      detail: overdue || dueSoon ? `เกินกำหนดส่งรายงาน ${numberFormat.format(overdue)} · ใกล้ครบกำหนด ${numberFormat.format(dueSoon)}` : undefined, urgent: overdue > 0 },
    { href: "/loans", icon: "users", label: "ครุภัณฑ์ที่ถูกยืมอยู่", count: queue.activeLoans,
      detail: queue.overdueLoans ? `เกินกำหนดคืน ${numberFormat.format(queue.overdueLoans)} รายการ` : undefined, urgent: queue.overdueLoans > 0 },
  ];
  // Zero counts carry no work: hide them, and say so once when nothing is pending.
  const pending = items.filter((item) => item.count > 0);
  if (!pending.length && !urgentRounds.length) {
    return (
      <p role="status" className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--state-success-border)] bg-[var(--state-success-bg)] px-3 py-2 text-sm font-medium text-[var(--state-success-fg)]">
        <AppIcon name="check" className="h-4 w-4 shrink-0" /> ไม่มีงานค้าง
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {pending.map((item) => <QueueItem key={item.href} {...item} />)}
      </ul>
      {urgentRounds.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">รอบตรวจนับที่ใกล้/เกินกำหนดส่งรายงาน</h3>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {urgentRounds.map((round) => (
              <li key={round.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Link href={`/inspection/${round.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{round.roundName}</Link>
                <span className="text-xs text-[var(--muted)]">{round.facilityName} · ค้างตรวจ {numberFormat.format(round.remainingItems)}</span>
                <StatusBadge tone={round.state === "overdue" ? "danger" : "warning"}>
                  {DEADLINE_LABELS[round.state]} {formatThaiDate(round.dueDate)}{round.state === "overdue" ? ` (${numberFormat.format(-round.daysLeft)} วัน)` : ` (อีก ${numberFormat.format(round.daysLeft)} วัน)`}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
