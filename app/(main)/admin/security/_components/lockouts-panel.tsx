import { ConfirmSubmitButton } from "@/app/(main)/admin/security/_components/confirm-submit-button";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import type { LockedAccount, LockedIp } from "@/lib/login-lockout";
import type { IpGeoRow } from "@/lib/visitor-log-data";

import { unlockAccountAction, unlockIpAction } from "../lockout-actions";
import { IpLocation } from "./ip-location";

type Policy = { windowMinutes: number; maxPerAccount: number; maxPerIp: number };

/** N3: บัญชี/IP ที่ถูกล็อกชั่วคราวอยู่ตอนนี้ พร้อมปุ่มปลดล็อก */
export function LockoutsPanel({
  accounts,
  ips,
  policy,
  geo,
  notice,
  error,
}: {
  accounts: LockedAccount[];
  ips: LockedIp[];
  policy: Policy;
  geo: Map<string, IpGeoRow>;
  notice: string;
  error: string;
}) {
  const total = accounts.length + ips.length;
  return (
    <section id="lockouts" aria-labelledby="lockouts-heading" className="glass-panel scroll-mt-24 overflow-hidden rounded-2xl">
      <div className="border-b border-[var(--line)] px-5 py-3">
        <h2 id="lockouts-heading" className="flex items-center gap-2 text-base font-semibold">
          <AppIcon name="lock" size={18} className={total ? "text-[var(--state-danger-fg)]" : "text-[var(--primary)]"} /> บัญชีและ IP ที่ถูกล็อกชั่วคราว
          {total > 0 && <StatusBadge tone="danger">{total.toLocaleString("th-TH")}</StatusBadge>}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          ใส่รหัสผ่านผิด {policy.maxPerAccount} ครั้งใน {policy.windowMinutes} นาที ล็อกบัญชีนั้น · ผิดรวม {policy.maxPerIp} ครั้งจาก IP เดียว ล็อก IP นั้น ·
          ปลดล็อกเองเมื่อครบเวลา และแจ้ง Telegram ทันทีที่ถูกล็อก
        </p>
      </div>
      {notice && <p role="status" className="mx-5 mt-3 rounded-xl border border-[var(--state-success-border)] bg-[var(--state-success-bg)] px-4 py-2.5 text-sm text-[var(--state-success-fg)]">{notice}</p>}
      {error && <p role="alert" className="mx-5 mt-3 rounded-xl border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-2.5 text-sm text-[var(--state-danger-fg)]">{error}</p>}

      {total === 0 ? (
        <p className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-[var(--muted)]">
          <AppIcon name="check" size={16} className="text-[var(--state-success-fg)]" /> ไม่มีบัญชีหรือ IP ที่ถูกล็อกอยู่
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {accounts.map((row) => (
            <li key={`a:${row.identity}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  <AppIcon name="user" size={14} className="mr-1 inline text-[var(--muted)]" />
                  {row.identity}
                  {row.displayName && <span className="font-normal text-[var(--muted)]"> · {row.displayName}</span>}
                  {!row.exists && <StatusBadge tone="warning" className="ml-2 text-[10px]">ไม่มีบัญชีนี้ในระบบ</StatusBadge>}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  ผิด {row.failures.toLocaleString("th-TH")} ครั้ง · จาก {row.ips.slice(0, 3).join(", ")}
                  {row.ips.length > 3 ? ` และอีก ${row.ips.length - 3} IP` : ""} · ปลดล็อกเองในอีก {row.minutesLeft.toLocaleString("th-TH")} นาที
                </p>
              </div>
              {row.exists && (
                <form action={unlockAccountAction}>
                  <input type="hidden" name="username" value={row.identity} />
                  <ConfirmSubmitButton message={`ปลดล็อกบัญชี ${row.identity}? (ควรยืนยันกับเจ้าของบัญชีก่อนว่าเป็นคนพิมพ์ผิดเอง)`} className="secondary-action action-sm gap-1.5">
                    <AppIcon name="unlock" size={14} /> ปลดล็อก
                  </ConfirmSubmitButton>
                </form>
              )}
            </li>
          ))}
          {ips.map((row) => (
            <li key={`i:${row.ip}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <IpLocation ip={row.ip} geo={geo.get(row.ip)} href={`/admin/security/?ip=${encodeURIComponent(row.ip)}&days=1`} />
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  ผิด {row.failures.toLocaleString("th-TH")} ครั้ง · ลอง {row.identities.length.toLocaleString("th-TH")} บัญชี ({row.identities.slice(0, 4).join(", ")}
                  {row.identities.length > 4 ? ", …" : ""}) · ปลดล็อกเองในอีก {row.minutesLeft.toLocaleString("th-TH")} นาที
                </p>
              </div>
              <form action={unlockIpAction}>
                <input type="hidden" name="ip" value={row.ip} />
                <ConfirmSubmitButton message={`ปลดล็อก IP ${row.ip}? ทุกคนที่ใช้ IP นี้จะลองรหัสผ่านต่อได้`} className="secondary-action action-sm gap-1.5">
                  <AppIcon name="unlock" size={14} /> ปลดล็อก IP
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
