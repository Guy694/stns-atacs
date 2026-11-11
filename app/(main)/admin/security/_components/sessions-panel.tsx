import Link from "next/link";

import { ConfirmSubmitButton } from "@/app/(main)/admin/security/_components/confirm-submit-button";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { formatThaiDateTime } from "@/lib/date-format";
import type { ActiveSession } from "@/lib/session-admin";
import { loginMethodLabel, sessionDeviceLabel, sessionStatus } from "@/lib/session-meta";
import type { IpGeoRow } from "@/lib/visitor-log-data";

import { revokeSessionAction, revokeUserSessionsAction } from "../session-actions";
import { IpLocation } from "./ip-location";

const ROLE_LABEL: Record<string, string> = { admin: "ผู้ดูแลระบบ", officer: "เจ้าหน้าที่", viewer: "ผู้ดูข้อมูล" };

/** SEC2: who is signed in right now, from where, on what — with force sign-out. */
export function SessionsPanel({
  sessions,
  tracked,
  geo,
  notice,
  error,
  nowMs,
}: {
  sessions: ActiveSession[];
  tracked: boolean;
  geo: Map<string, IpGeoRow>;
  notice: string;
  error: string;
  nowMs: number;
}) {
  const users = new Set(sessions.map((session) => session.userId)).size;
  const activeNow = sessions.filter((session) => sessionStatus(session, nowMs) === "active").length;
  const sessionsPerUser = new Map<number, number>();
  for (const session of sessions) sessionsPerUser.set(session.userId, (sessionsPerUser.get(session.userId) ?? 0) + 1);

  return (
    <section id="sessions" aria-labelledby="sessions-heading" className="glass-panel scroll-mt-24 overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
        <div>
          <h2 id="sessions-heading" className="flex items-center gap-2 text-base font-semibold">
            <AppIcon name="users" size={18} className="text-[var(--primary)]" /> ผู้ที่เข้าสู่ระบบอยู่ตอนนี้
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {users.toLocaleString("th-TH")} คน · {sessions.length.toLocaleString("th-TH")} เซสชัน · ใช้งานใน 5 นาทีล่าสุด {activeNow.toLocaleString("th-TH")} เซสชัน
          </p>
        </div>
        <Link href="/admin/security/?type=login_succeeded&days=30" className="secondary-action action-sm gap-1.5">
          <AppIcon name="history" size={15} /> ประวัติการเข้าสู่ระบบ
        </Link>
      </div>

      {notice && <p role="status" className="mx-5 mt-3 rounded-xl border border-[var(--state-success-border)] bg-[var(--state-success-bg)] px-4 py-2.5 text-sm text-[var(--state-success-fg)]">{notice}</p>}
      {error && <p role="alert" className="mx-5 mt-3 rounded-xl border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-2.5 text-sm text-[var(--state-danger-fg)]">{error}</p>}
      {!tracked && (
        <p className="mx-5 mt-3 rounded-xl border border-[var(--state-info-border)] bg-[var(--state-info-bg)] px-4 py-2.5 text-sm text-[var(--state-info-fg)]">
          ยังไม่ได้บันทึก IP และอุปกรณ์ของเซสชัน — รัน <code>database/add_session_metadata.sql</code> แล้วข้อมูลจะเริ่มเก็บตั้งแต่การเข้าสู่ระบบครั้งถัดไป
        </p>
      )}

      {sessions.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">ไม่มีผู้ที่เข้าสู่ระบบอยู่</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-black/[0.03] text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">ผู้ใช้</th>
                <th className="px-4 py-2.5 font-medium">IP / ตำแหน่ง</th>
                <th className="px-4 py-2.5 font-medium">อุปกรณ์ / ช่องทาง</th>
                <th className="px-4 py-2.5 font-medium">เข้าสู่ระบบ · ใช้งานล่าสุด</th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const status = sessionStatus(session, nowMs);
                const ip = session.lastIp ?? session.ip;
                return (
                  <tr key={session.id} className="border-t border-[var(--line)] align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{session.userName}</p>
                      <p className="text-xs text-[var(--muted)]">{[ROLE_LABEL[session.role] ?? session.role, session.facilityName].filter(Boolean).join(" · ")}</p>
                      {session.isCurrent && <StatusBadge tone="primary" className="mt-1 text-[10px]">เซสชันของคุณ</StatusBadge>}
                    </td>
                    <td className="px-4 py-2.5">
                      {ip ? <IpLocation ip={ip} geo={geo.get(ip)} href={`/admin/security/visitors/?ip=${encodeURIComponent(ip)}`} /> : <span className="text-xs text-[var(--muted)]">ไม่ทราบ</span>}
                      {session.ip && session.lastIp && session.ip !== session.lastIp && (
                        <p className="mt-1 text-[11px] text-[var(--state-warning-fg)]">เปลี่ยน IP ระหว่างใช้งาน (เริ่มที่ {session.ip})</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <p>{sessionDeviceLabel(session.userAgent)}</p>
                      <p className="text-[var(--muted)]">{loginMethodLabel(session.loginMethod)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums">
                      <p className="text-[var(--muted)]">{formatThaiDateTime(session.createdAt)}</p>
                      <p className="mt-0.5 flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
                        {session.lastSeenAt ? formatThaiDateTime(session.lastSeenAt) : "—"}
                        <span className="sr-only">{status === "active" ? "กำลังใช้งาน" : "ไม่ได้ใช้งาน"}</span>
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-end gap-1.5">
                        {!session.isCurrent && (
                          <form action={revokeSessionAction}>
                            <input type="hidden" name="sessionId" value={session.id} />
                            <ConfirmSubmitButton
                              message={`บังคับออกจากระบบเครื่องนี้ของ ${session.userName}?`}
                              className="danger-action action-sm gap-1.5 whitespace-nowrap"
                            >
                              <AppIcon name="logout" size={14} /> ออกจากระบบเครื่องนี้
                            </ConfirmSubmitButton>
                          </form>
                        )}
                        {(sessionsPerUser.get(session.userId) ?? 0) > 1 && (
                          <form action={revokeUserSessionsAction}>
                            <input type="hidden" name="userId" value={session.userId} />
                            <input type="hidden" name="userName" value={session.userName} />
                            <ConfirmSubmitButton
                              message={`บังคับออกจากระบบทุกเครื่องของ ${session.userName}?${session.isCurrent ? " (เซสชันของคุณเองจะไม่หลุด)" : ""}`}
                              className="secondary-action action-sm whitespace-nowrap text-xs"
                            >
                              ทุกเครื่องของผู้ใช้นี้
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-[var(--line)] px-5 py-2.5 text-xs text-[var(--muted)]">
        ผู้ที่ถูกบังคับออกจะหลุดเมื่อกดหน้าถัดไป · เซสชันหมดอายุเองเมื่อไม่ใช้งาน {Number(process.env.AUTH_IDLE_TIMEOUT_MINUTES ?? 15).toLocaleString("th-TH")} นาที · ทุกครั้งบันทึกใน Audit Log และแจ้ง Telegram
      </p>
    </section>
  );
}
