import "server-only";

import { getBooleanSetting } from "@/lib/app-settings";

type ThaiIdStatus = {
  enabled: boolean;
  reason: string | null;
};

type ThaiIdConfig = {
  enabled: boolean;
  reason: string | null;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  callbackUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
};

const DEFAULT_AUTHORIZE_URL = "https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/";
const DEFAULT_TOKEN_URL = "https://imauth.bora.dopa.go.th/api/v2/oauth2/token/";
const DEFAULT_USERINFO_URL = "https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/";

const THAIID_CALLBACK_PATH = "/api/auth/thaiid/callback";
const THAI_D_ENABLED_KEY = "auth.thaid.enabled";

function isEnabledByFlag() {
  const rawFlag = (process.env.THAID_ENABLED ?? process.env.THAIID_ENABLED ?? "true").trim().toLowerCase();
  return rawFlag !== "0" && rawFlag !== "false" && rawFlag !== "off";
}

function normalizeCallbackUrl(origin: string) {
  const rawCallback = (process.env.CALLBACK ?? "").trim();

  if (!rawCallback) {
    return `${origin}${THAIID_CALLBACK_PATH}`;
  }

  if (rawCallback.startsWith("http://") || rawCallback.startsWith("https://")) {
    try {
      const parsed = new URL(rawCallback);
      if (parsed.pathname === "/" || parsed.pathname === "") {
        return `${parsed.origin}${THAIID_CALLBACK_PATH}`;
      }
      return parsed.toString();
    } catch {
      return `${origin}${THAIID_CALLBACK_PATH}`;
    }
  }

  if (rawCallback.startsWith("/")) {
    if (rawCallback === "/" || rawCallback.endsWith("/")) {
      return `${origin}${THAIID_CALLBACK_PATH}`;
    }
    return `${origin}${rawCallback}`;
  }

  return `${origin}${THAIID_CALLBACK_PATH}`;
}

export async function getThaiIdStatus(): Promise<ThaiIdStatus> {
  const enabled = await getBooleanSetting(THAI_D_ENABLED_KEY, isEnabledByFlag());

  if (!enabled) {
    return {
      enabled: false,
      reason: "ระบบ ThaiD ถูกปิดใช้งานชั่วคราว กรุณาเข้าสู่ระบบด้วย Username/Password",
    };
  }

  const clientId = (process.env.CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.CLIENT_SECRET ?? "").trim();
  const apiKey = (process.env.APIKEY ?? process.env.THAIID_API_KEY ?? "").trim();

  if (!clientId || !clientSecret || !apiKey) {
    return {
      enabled: false,
      reason: "ยังไม่ได้ตั้งค่า CLIENT_ID / CLIENT_SECRET / APIKEY สำหรับ ThaiD",
    };
  }

  return {
    enabled: true,
    reason: null,
  };
}

export async function getThaiIdConfig(origin: string): Promise<ThaiIdConfig> {
  const status = await getThaiIdStatus();
  const clientId = (process.env.CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.CLIENT_SECRET ?? "").trim();
  const apiKey = (process.env.APIKEY ?? process.env.THAIID_API_KEY ?? "").trim();

  return {
    enabled: status.enabled,
    reason: status.reason,
    clientId,
    clientSecret,
    apiKey,
    callbackUrl: normalizeCallbackUrl(origin),
    authorizeUrl: (process.env.THAIID_AUTHORIZE_URL ?? DEFAULT_AUTHORIZE_URL).trim(),
    tokenUrl: (process.env.THAIID_TOKEN_URL ?? DEFAULT_TOKEN_URL).trim(),
    userInfoUrl: (process.env.THAIID_USERINFO_URL ?? DEFAULT_USERINFO_URL).trim(),
  };
}