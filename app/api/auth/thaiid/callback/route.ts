import { NextRequest, NextResponse } from "next/server";

import {
  clearPendingRegistrationClaim,
  createSession,
  findOrLinkUserByVerifiedThaiD,
  getUserDisplayName,
  normalizeDisplayName,
  normalizeThaiCid,
  setPendingThaiDRegistrationClaim,
} from "@/lib/auth";
import { getThaiIdConfig } from "@/lib/thaiid";
import { notifyTelegramSafe } from "@/lib/telegram";
import { recordSecurityEvent } from "@/lib/security";

const STATE_COOKIE_NAME = "atacs_thaid_state";

type ThaiIdTokenResponse = {
  access_token?: string;
  // Scope values are returned directly in the token response (when openid scope is NOT requested)
  pid?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
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

function requestDetails(req: NextRequest) {
  return {
    IP: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown",
    "User Agent": req.headers.get("user-agent") ?? "unknown",
  };
}

async function recordThaiDSecurityEvent(req: NextRequest, eventType: string, detail: string, identity?: string) {
  const context = requestDetails(req);
  await recordSecurityEvent({
    eventType,
    ipAddress: context.IP,
    identity,
    path: req.nextUrl.pathname,
    detail,
  });
  return context;
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

function readThaiCid(token: ThaiIdTokenResponse) {
  return normalizeThaiCid(String(token.pid ?? ""));
}

function readDisplayName(token: ThaiIdTokenResponse) {
  const full = normalizeDisplayName(String(token.name ?? ""));
  if (full) return full;
  const merged = normalizeDisplayName(
    `${String(token.given_name ?? "")} ${String(token.family_name ?? "")}`
  );
  return merged || "ผู้ใช้งาน ThaiD";
}

export async function GET(req: NextRequest) {
  const config = await getThaiIdConfig(req.nextUrl.origin);
  const stateCookie = req.cookies.get(STATE_COOKIE_NAME)?.value;
  const queryState = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  const error = req.nextUrl.searchParams.get("error")?.trim() ?? "";
  const errorDescription = req.nextUrl.searchParams.get("error_description")?.trim() ?? "";

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
    const detail = errorDescription ? ` (${errorDescription})` : "";
    const context = await recordThaiDSecurityEvent(req, "thaid_oauth_error", `${error}${detail}`);
    await notifyTelegramSafe({
      category: "security",
      title: "ThaiD login ไม่สำเร็จ",
      details: { สาเหตุ: `${error}${detail}`, ...context },
    });
    const response = NextResponse.redirect(
      toLoginUrl(req, {
        error: `ThaiD เกิดข้อผิดพลาด: ${error}${detail}`,
        tab: "password",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  }

  if (!stateCookie || !queryState || stateCookie !== queryState) {
    const context = await recordThaiDSecurityEvent(req, "thaid_oauth_state_mismatch", "OAuth state ไม่ถูกต้อง");
    await notifyTelegramSafe({
      category: "security",
      title: "ตรวจพบ ThaiD OAuth state ไม่ถูกต้อง",
      details: context,
    });
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
    // Per official DOPA API doc v1.1.0 section 6.2.1:
    // Token request uses Authorization: Basic Base64(client_id:client_secret)
    const basicCredentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl,
    });

    const tokenResponse = await fetchWithTimeout(
      config.tokenUrl,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${basicCredentials}`,
        },
        body: tokenParams.toString(),
      },
      30000
    );

    if (!tokenResponse.ok) {
      throw new Error(`ThaiD token exchange failed (${tokenResponse.status})`);
    }

    // Per official DOPA API doc v1.1.0 section 6.2.2:
    // When scope does NOT include "openid", scope values (pid, name, etc.) are
    // returned directly in the token response JSON.
    const tokenJson = (await tokenResponse.json()) as ThaiIdTokenResponse;
    const thaiCid = readThaiCid(tokenJson);
    const displayName = readDisplayName(tokenJson);

    if (!/^\d{13}$/.test(thaiCid)) {
      throw new Error("ThaiD ไม่ส่งเลขบัตรประชาชน 13 หลัก");
    }

    const user = await findOrLinkUserByVerifiedThaiD({
      thaiCid,
      firstName: typeof tokenJson.given_name === "string" ? tokenJson.given_name : "",
      lastName: typeof tokenJson.family_name === "string" ? tokenJson.family_name : "",
    });
    if (user) {
      if (!user.is_active) {
        const context = await recordThaiDSecurityEvent(req, "login_pending_account", "ThaiD", getUserDisplayName(user));
        await notifyTelegramSafe({
          category: "security",
          title: "บัญชีที่ยังไม่ได้รับอนุมัติพยายามเข้าสู่ระบบ",
          details: { ผู้ใช้: getUserDisplayName(user), วิธี: "ThaiD", ...context },
        });
        const response = NextResponse.redirect(new URL("/pending-approval", req.url));
        response.cookies.delete(STATE_COOKIE_NAME);
        return response;
      }

      await clearPendingRegistrationClaim();
      await createSession(user.id);
      await notifyTelegramSafe({
        category: "security",
        title: "เข้าสู่ระบบสำเร็จ",
        details: { ผู้ใช้: getUserDisplayName(user), วิธี: "ThaiD", ...requestDetails(req) },
      });

      const response = NextResponse.redirect(new URL("/", req.url));
      response.cookies.delete(STATE_COOKIE_NAME);
      return response;
    }

    await setPendingThaiDRegistrationClaim(thaiCid, displayName);
    const response = NextResponse.redirect(
      toRegisterUrl(req, {
        notice: "ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาสมัครสมาชิกครั้งแรก",
      })
    );
    response.cookies.delete(STATE_COOKIE_NAME);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบด้วย ThaiD ได้";
    const context = await recordThaiDSecurityEvent(req, "thaid_login_failed", message);
    await notifyTelegramSafe({
      category: "security",
      title: "ThaiD login ไม่สำเร็จ",
      details: { สาเหตุ: message, ...context },
    });
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
