import "server-only";

import type { RowDataPacket } from "mysql2";

import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { getGoogleAuthStatus } from "@/lib/google-auth";
import { selectRows } from "@/lib/mysql";
import {
  effectivePasswordLoginMode,
  normalizePasswordLoginMode,
  type PasswordLoginMode,
  type PasswordModeOverride,
} from "@/lib/password-login-policy";
import { getThaiIdStatus } from "@/lib/thaiid";

const SETTING_KEY = "auth.password.mode";

function forceOnFromEnv() {
  return ["1", "true", "on", "yes"].includes((process.env.AUTH_PASSWORD_LOGIN_FORCE ?? "").trim().toLowerCase());
}

export type PasswordLoginState = {
  stored: PasswordLoginMode;
  mode: PasswordLoginMode;
  override: PasswordModeOverride;
  thaiIdEnabled: boolean;
  googleEnabled: boolean;
  altLoginAvailable: boolean;
};

/** Never throws: an unreadable setting means password login stays on (fail open only towards "can still sign in"). */
export async function getPasswordLoginState(): Promise<PasswordLoginState> {
  const [raw, thaiId] = await Promise.all([getAppSetting(SETTING_KEY).catch(() => null), getThaiIdStatus().catch(() => ({ enabled: false }))]);
  const googleEnabled = getGoogleAuthStatus().enabled;
  const altLoginAvailable = thaiId.enabled || googleEnabled;
  const stored = normalizePasswordLoginMode(raw);
  const { mode, override } = effectivePasswordLoginMode(stored, { altLoginAvailable, forceOn: forceOnFromEnv() });
  return { stored, mode, override, thaiIdEnabled: thaiId.enabled, googleEnabled, altLoginAvailable };
}

export async function setPasswordLoginMode(mode: PasswordLoginMode) {
  await setAppSetting(SETTING_KEY, mode);
}

export async function userHasExternalLogin(userId: number) {
  const rows = await selectRows<RowDataPacket & { linked: number }>(
    `SELECT (thaid_cid IS NOT NULL OR thaid_cid_hash IS NOT NULL OR google_sub IS NOT NULL) AS linked FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return Boolean(Number(rows[0]?.linked ?? 0));
}

export type LoginMethodCoverage = { role: string; active: number; withPassword: number; withExternal: number };

/** How many active accounts per role could still sign in if passwords were switched off. */
export async function loginMethodCoverage(): Promise<LoginMethodCoverage[]> {
  const rows = await selectRows<RowDataPacket & { role: string; active: number; with_password: number; with_external: number }>(
    `SELECT role, COUNT(*) AS active,
            SUM(password_hash IS NOT NULL) AS with_password,
            SUM(thaid_cid IS NOT NULL OR thaid_cid_hash IS NOT NULL OR google_sub IS NOT NULL) AS with_external
     FROM users WHERE is_active = 1 GROUP BY role ORDER BY FIELD(role, 'admin', 'officer', 'viewer')`
  );
  return rows.map((row) => ({ role: row.role, active: Number(row.active), withPassword: Number(row.with_password), withExternal: Number(row.with_external) }));
}
