import { ConfirmSubmitButton } from "@/app/(main)/admin/security/_components/confirm-submit-button";
import { revokeMyOtherSessionsAction } from "@/app/(main)/admin/security/session-actions";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { formatThaiDateTime } from "@/lib/date-format";
import type { ActiveSession } from "@/lib/session-admin";
import { loginMethodLabel, sessionDeviceLabel } from "@/lib/session-meta";

/** อุปกรณ์ที่เข้าสู่ระบบด้วยบัญชีนี้ — the user can sign out every other device. */
export function MySessions({ sessions, notice }: { sessions: ActiveSession[]; notice: string }) {
  const others = sessions.filter((session) => !session.isCurrent).length;
  return (
    <section id="my-sessions" aria-labelledby="my-sessions-heading" className="glass-panel scroll-mt-24 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="my-sessions-heading" className="flex items-center gap-2 text-base font-semibold">
            <AppIcon name="monitor" size={18} className="text-[var(--primary)]" /> อุปกรณ์ที่เข้าสู่ระบบด้วยบัญชีนี้
          </h2>
          <p className="text-xs text-[var(--muted)]">ถ้าเห็นอุปกรณ์หรือ IP ที่ไม่ใช่ของคุณ ให้กดออกจากระบบเครื่องอื่น แล้วเปลี่ยนรหัสผ่าน</p>
        </div>
        {others > 0 && (
          <form action={revokeMyOtherSessionsAction}>
            <ConfirmSubmitButton message={`ออกจากระบบอุปกรณ์อื่นทั้งหมด ${others} เครื่อง?`} className="danger-action action-sm gap-1.5">
              <AppIcon name="logout" size={14} /> ออกจากระบบเครื่องอื่นทั้งหมด
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
      {notice && <p role="status" className="mt-3 rounded-xl border border-[var(--state-success-border)] bg-[var(--state-success-bg)] px-4 py-2.5 text-sm text-[var(--state-success-fg)]">{notice}</p>}
      <ul className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">
                {sessionDeviceLabel(session.userAgent)}
                {session.isCurrent && <StatusBadge tone="success" className="ml-2 text-[10px]">เครื่องนี้</StatusBadge>}
              </span>
              <span className="block text-xs text-[var(--muted)]">
                {[session.lastIp ?? session.ip, loginMethodLabel(session.loginMethod)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="text-xs tabular-nums text-[var(--muted)]">ใช้งานล่าสุด {formatThaiDateTime(session.lastSeenAt ?? session.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
