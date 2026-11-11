/**
 * Username/Password login switch (admin › ความปลอดภัยระบบ).
 * Pure rules; storage is app_settings "auth.password.mode" (lib/password-login.ts).
 *
 * Lock-out guards:
 * - "admin-only"/"off" need ThaiD or Google to be enabled, otherwise staff could not sign in at all.
 * - "off" also needs the admin making the change to have ThaiD/Google linked to their own account.
 * - If ThaiD and Google are both turned off later, password login silently reverts to everyone.
 * - Break-glass: AUTH_PASSWORD_LOGIN_FORCE=on in the environment re-enables it regardless of the setting.
 */
export type PasswordLoginMode = "all" | "admin-only" | "off";

export const PASSWORD_LOGIN_MODES: readonly { key: PasswordLoginMode; label: string; description: string }[] = [
  { key: "all", label: "เปิดสำหรับทุกคน", description: "ทุกบัญชีที่มีรหัสผ่านเข้าสู่ระบบด้วย Username/Password ได้" },
  { key: "admin-only", label: "เฉพาะผู้ดูแลระบบ", description: "เจ้าหน้าที่ต้องใช้ ThaiD หรือ Google ส่วนผู้ดูแลระบบยังใช้รหัสผ่านได้ (สำรองกรณีฉุกเฉิน)" },
  { key: "off", label: "ปิดทั้งหมด", description: "ทุกคนต้องเข้าสู่ระบบด้วย ThaiD หรือ Google เท่านั้น" },
];

export function normalizePasswordLoginMode(value: string | null | undefined): PasswordLoginMode {
  return value === "off" || value === "admin-only" ? value : "all";
}

export type PasswordModeOverride = "env" | "no-alt-login" | null;

export function effectivePasswordLoginMode(
  stored: PasswordLoginMode,
  { altLoginAvailable, forceOn }: { altLoginAvailable: boolean; forceOn: boolean }
): { mode: PasswordLoginMode; override: PasswordModeOverride } {
  if (stored === "all") return { mode: "all", override: null };
  if (forceOn) return { mode: "all", override: "env" };
  if (!altLoginAvailable) return { mode: "all", override: "no-alt-login" };
  return { mode: stored, override: null };
}

export function passwordLoginAllowedFor(mode: PasswordLoginMode, role: string) {
  return mode === "all" || (mode === "admin-only" && role === "admin");
}

/** Returns a Thai error message when the change is unsafe, otherwise null. */
export function validatePasswordLoginModeChange(
  next: PasswordLoginMode,
  { altLoginAvailable, actorHasExternalLogin }: { altLoginAvailable: boolean; actorHasExternalLogin: boolean }
): string | null {
  if (next === "all") return null;
  if (!altLoginAvailable) return "ต้องเปิดการเข้าสู่ระบบด้วย ThaiD หรือ Google ก่อน มิฉะนั้นเจ้าหน้าที่จะเข้าระบบไม่ได้";
  if (next === "off" && !actorHasExternalLogin) {
    return "บัญชีของคุณยังไม่ได้ผูก ThaiD หรือ Google — ถ้าปิดรหัสผ่านทั้งหมดคุณจะเข้าระบบไม่ได้ ให้เข้าสู่ระบบด้วย ThaiD/Google หนึ่งครั้งเพื่อผูกบัญชีก่อน";
  }
  return null;
}
