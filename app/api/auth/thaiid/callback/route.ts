import { NextRequest, NextResponse } from "next/server";

import {
  clearPendingRegistrationClaim,
  createSession,
  findUserByThaiCid,
  normalizeDisplayName,
  normalizeThaiCid,
  setPendingRegistrationClaim,
} from "@/lib/auth";
import { getThaiIdConfig } from "@/lib/thaiid";

const STATE_COOKIE_NAME = "atacs_thaid_state";

type ThaiIdTokenResponse = {
  access_token?: string;
};

type ThaiIdProfile = {
  pid?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  first_name?: string;
  last_name?: string;
};

function toLoginUrl(req: NextRequest, search: Record<string, string>) {
  const url = new URL("/login", req.url);
  for (const [key, value] of Object.entries(search)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function toRegisterUrl(req: NextRequest, search: Record<string, string>) {
  const url = new URL("/register", req.url);
  for (const [key, value] of Object.entries(search)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function readThaiCid(profile: ThaiIdProfile) {
  return normalizeThaiCid(String(profile.pid ?? ""));
}

function readDisplayName(profile: ThaiIdProfile) {
  const full = normalizeDisplayName(String(profile.name ?? ""));
  if (full) return full;
  const merged = normalizeDisplayName(
    `${String(profile.given_name ?? profile.first_name ?? "")} ${String(profile.family_name ?? profile.last_name ?? "")}`
  );
  return merged || "ผู้ใช้งาน ThaiD";
}

export async function GET(req: NextRequest) {
  const config = getThaiIdConfig(req.nextUrl.origin);
  const stateCookie = req.cookies.get(STATE_COOKIE_NAME)?.value;
  const queryState = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  const error = req.nextUrl.searchParams.get("error")?.trim() ?? "";

  if (!config.enabled) {
    const response = NextResponse.redirect(
      toLoginUrl(req, {
        error: config.reason ?? "ThaiD ไม่พร้อมใช้งาน",
        tab: "password",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  }

  if (error) {
    const response = NextResponse.redirect(
      toLoginUrl(req, {
        error: `ThaiD เกิดข้อผิดพลาด: ${error}`,
        tab: "password",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  }

  if (!stateCookie || !queryState || stateCookie !== queryState) {
    const response = NextResponse.redirect(
      toLoginUrl(req, {
        error: "เซสชัน ThaiD ไม่ถูกต้อง กรุณาลองใหม่",
        tab: "password",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(
      toLoginUrl(req, {
        error: "ไม่พบรหัสยืนยันจาก ThaiD กรุณาลองใหม่",
        tab: "password",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const tokenResponse = await fetchWithTimeout(
      config.tokenUrl,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-api-key": config.apiKey,
        },
        body: tokenParams.toString(),
      },
      30000
    );

    if (!tokenResponse.ok) {
      throw new Error(`ThaiD token exchange failed (${tokenResponse.status})`);
    }

    const tokenJson = (await tokenResponse.json()) as ThaiIdTokenResponse;
    const accessToken = String(tokenJson.access_token ?? "").trim();

    if (!accessToken) {
      throw new Error("ThaiD access token is missing");
    }

    const profileResponse = await fetchWithTimeout(
      config.userInfoUrl,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-api-key": config.apiKey,
          accept: "application/json",
        },
      },
      30000
    );

    if (!profileResponse.ok) {
      throw new Error(`ThaiD user info failed (${profileResponse.status})`);
    }

    const profile = (await profileResponse.json()) as ThaiIdProfile;
    const thaiCid = readThaiCid(profile);
    const displayName = readDisplayName(profile);

    if (!/^\d{13}$/.test(thaiCid)) {
      throw new Error("ThaiD ไม่ส่งเลขบัตรประชาชน 13 หลัก");
    }

    const user = await findUserByThaiCid(thaiCid);
    if (user) {
      if (!user.is_active) {
        const response = NextResponse.redirect(new URL("/pending-approval", req.url));
        response.cookies.delete(STATE_COOKIE_NAME);
        return response;
      }

      await clearPendingRegistrationClaim();
      await createSession(user.id);

      const response = NextResponse.redirect(new URL("/", req.url));
      response.cookies.delete(STATE_COOKIE_NAME);
      return response;
    }

    await setPendingRegistrationClaim(thaiCid, displayName);
    const response = NextResponse.redirect(
      toRegisterUrl(req, {
        notice: "ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาสมัครสมาชิกครั้งแรก",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบด้วย ThaiD ได้";
    const isTimeout = message.includes("Abort") || message.toLowerCase().includes("timeout");
    const response = NextResponse.redirect(
      toLoginUrl(req, {
        error: isTimeout
          ? "การเชื่อมต่อ ThaiD หมดเวลา ระบบสลับไปใช้ Username/Password ให้แล้ว"
          : `${message} กรุณาเข้าสู่ระบบด้วย Username/Password ชั่วคราว`,
        tab: "password",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  }
}
