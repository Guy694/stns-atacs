import "server-only";

type GoogleAuthStatus = {
  enabled: boolean;
  reason: string | null;
};

type GoogleAuthConfig = GoogleAuthStatus & {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
};

const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
const DEFAULT_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function isEnabledByFlag() {
  const flag = (process.env.GOOGLE_AUTH_ENABLED ?? "true").trim().toLowerCase();
  return !["0", "false", "off"].includes(flag);
}

export function getGoogleAuthStatus(): GoogleAuthStatus {
  if (!isEnabledByFlag()) {
    return { enabled: false, reason: "ระบบเข้าสู่ระบบด้วย Google ถูกปิดใช้งานชั่วคราว" };
  }

  if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    return {
      enabled: false,
      reason: "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
    };
  }

  if (!process.env.AUTH_SECRET?.trim()) {
    return {
      enabled: false,
      reason: "ยังไม่ได้ตั้งค่า AUTH_SECRET สำหรับเซสชันลงทะเบียน",
    };
  }

  return { enabled: true, reason: null };
}

export function getGoogleAuthConfig(origin: string): GoogleAuthConfig {
  const status = getGoogleAuthStatus();
  return {
    ...status,
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL?.trim() || `${origin}${GOOGLE_CALLBACK_PATH}`,
    authorizeUrl: process.env.GOOGLE_AUTHORIZE_URL?.trim() || DEFAULT_AUTHORIZE_URL,
    tokenUrl: process.env.GOOGLE_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL,
    userInfoUrl: process.env.GOOGLE_USERINFO_URL?.trim() || DEFAULT_USERINFO_URL,
  };
}
