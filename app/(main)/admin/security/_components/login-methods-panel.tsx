import { SubmitButton } from "@/app/_components/ui/submit-button";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import type { LoginMethodCoverage, PasswordLoginState } from "@/lib/password-login";
import { PASSWORD_LOGIN_MODES } from "@/lib/password-login-policy";

import { updatePasswordLoginModeAction } from "../actions";

const ROLE_LABEL: Record<string, string> = { admin: "ผู้ดูแลระบบ", officer: "เจ้าหน้าที่", viewer: "ผู้ดูข้อมูล" };
const n = (value: number) => value.toLocaleString("th-TH");

/** ช่องทางเข้าสู่ระบบ: switch Username/Password with its impact (who would be locked out) shown up front. */
export function LoginMethodsPanel({
  state,
  coverage,
  notice,
  error,
}: {
  state: PasswordLoginState;
  coverage: LoginMethodCoverage[];
  notice: string;
  error: string;
}) {
  const current = PASSWORD_LOGIN_MODES.find((mode) => mode.key === state.mode)!;
  const officersWithoutExternal = coverage.filter((row) => row.role !== "admin").reduce((sum, row) => sum + (row.active - row.withExternal), 0);

  return (
    <section id="login-methods" aria-labelledby="login-methods-heading" className="glass-panel scroll-mt-24 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="login-methods-heading" className="flex items-center gap-2 text-base font-semibold">
          <AppIcon name="key" size={18} className="text-[var(--primary)]" /> ช่องทางเข้าสู่ระบบ
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">Username/Password:</span>
          <StatusBadge tone={state.mode === "all" ? "success" : state.mode === "admin-only" ? "warning" : "neutral"}>{current.label}</StatusBadge>
          <span className="text-[var(--muted)]">ThaiD:</span>
          <StatusBadge tone={state.thaiIdEnabled ? "success" : "neutral"}>{state.thaiIdEnabled ? "เปิด" : "ปิด"}</StatusBadge>
          <span className="text-[var(--muted)]">Google:</span>
          <StatusBadge tone={state.googleEnabled ? "success" : "neutral"}>{state.googleEnabled ? "เปิด" : "ปิด"}</StatusBadge>
        </div>
      </div>

      {notice && <p role="status" className="mt-3 rounded-xl border border-[var(--state-success-border)] bg-[var(--state-success-bg)] px-4 py-2.5 text-sm text-[var(--state-success-fg)]">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-2.5 text-sm text-[var(--state-danger-fg)]">{error}</p>}
      {state.override === "env" && (
        <p className="mt-3 rounded-xl border border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] px-4 py-2.5 text-sm text-[var(--state-warning-fg)]">
          เปิดสำหรับทุกคนชั่วคราวเพราะตั้ง <code>AUTH_PASSWORD_LOGIN_FORCE=on</code> บนเซิร์ฟเวอร์ (โหมดกู้คืน) — ลบค่านี้ออกเพื่อกลับไปใช้การตั้งค่าด้านล่าง
        </p>
      )}
      {state.override === "no-alt-login" && (
        <p className="mt-3 rounded-xl border border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] px-4 py-2.5 text-sm text-[var(--state-warning-fg)]">
          ตั้งไว้เป็น “{PASSWORD_LOGIN_MODES.find((mode) => mode.key === state.stored)?.label}” แต่ ThaiD และ Google ปิดอยู่ทั้งคู่ ระบบจึงเปิด Username/Password ให้ทุกคนอัตโนมัติ เพื่อไม่ให้ทุกคนเข้าระบบไม่ได้
        </p>
      )}

      <form action={updatePasswordLoginModeAction} className="mt-4">
        <fieldset>
          <legend className="text-sm font-medium">การเข้าสู่ระบบด้วย Username/Password</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {PASSWORD_LOGIN_MODES.map((mode) => (
              <label
                key={mode.key}
                className="flex cursor-pointer gap-3 rounded-xl border border-[var(--line)] bg-white p-3 transition-colors hover:border-[var(--primary-soft-strong)] has-[:checked]:border-[var(--nav-bg)] has-[:checked]:bg-[var(--primary-soft)]"
              >
                <input type="radio" name="mode" value={mode.key} defaultChecked={state.stored === mode.key} className="mt-1 h-4 w-4 shrink-0 accent-[var(--nav-bg)]" />
                <span>
                  <span className="block text-sm font-semibold">{mode.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{mode.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--muted)]">บัญชีที่ใช้งานอยู่ และช่องทางที่แต่ละบัญชีใช้ได้</p>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="py-1.5 pr-4 font-medium">บทบาท</th>
                    <th className="py-1.5 pr-4 text-right font-medium">บัญชี</th>
                    <th className="py-1.5 pr-4 text-right font-medium">มีรหัสผ่าน</th>
                    <th className="py-1.5 pr-4 text-right font-medium">ผูก ThaiD/Google แล้ว</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row) => (
                    <tr key={row.role} className="border-t border-[var(--line)]">
                      <td className="py-1.5 pr-4">{ROLE_LABEL[row.role] ?? row.role}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{n(row.active)}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{n(row.withPassword)}</td>
                      <td className={`py-1.5 pr-4 text-right font-semibold tabular-nums ${row.withExternal < row.active ? "text-[var(--state-warning-fg)]" : "text-[var(--state-success-fg)]"}`}>
                        {n(row.withExternal)} / {n(row.active)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {officersWithoutExternal > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--state-warning-fg)]">
                <AppIcon name="warning" size={14} className="mt-0.5 shrink-0" />
                ถ้าเลือก “เฉพาะผู้ดูแลระบบ” หรือ “ปิดทั้งหมด” เจ้าหน้าที่ {n(officersWithoutExternal)} คนที่ยังไม่ผูก ThaiD/Google จะต้องเข้าด้วย ThaiD/Google ครั้งแรกให้ได้ก่อน
                — ทดสอบว่าปุ่ม ThaiD ใช้งานได้จริงก่อนเปลี่ยน
              </p>
            )}
          </div>
          <SubmitButton pendingText="กำลังบันทึก…" className="primary-action gap-2 lg:self-end">
            <AppIcon name="check" size={16} /> บันทึกการตั้งค่า
          </SubmitButton>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          ทุกการเปลี่ยนแปลงบันทึกใน Audit Log และแจ้ง Telegram · ฉุกเฉิน: ตั้ง <code>AUTH_PASSWORD_LOGIN_FORCE=on</code> ให้ container แล้ว restart เพื่อเปิด Username/Password ชั่วคราว
        </p>
      </form>
    </section>
  );
}
