import { NextRequest, NextResponse } from "next/server";

import {
  clearPendingRegistrationClaim,
  createSession,
  findUserByEmail,
  findUserByGoogleSub,
  linkGoogleIdentity,
  normalizeDisplayName,
  setPendingGoogleRegistrationClaim,
} from "@/lib/auth";
import { getGoogleAuthConfig } from "@/lib/google-auth";
import { notifyTelegramSafe } from "@/lib/telegram";
import { recordSecurityEvent } from "@/lib/security";

const STATE_COOKIE_NAME = "atacs_google_state";
const NEXT_COOKIE_NAME = "atacs_google_next";

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function redirectWithDeletedState(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE_NAME);
  response.cookies.delete(NEXT_COOKIE_NAME);
  return response;
}

function safeNextPath(value: string | undefined) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\")) return "/dashboard";
  return value;
}

function loginUrl(req: NextRequest, message: string, nextPath = "/dashboard") {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", message);
  if (nextPath !== "/dashboard") url.searchParams.set("next", nextPath);
  return url;
}

function requestDetails(req: NextRequest) {
  return {
    IP: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown",
    "User Agent": req.headers.get("user-agent") ?? "unknown",
  };
}

async function recordGoogleSecurityEvent(req: NextRequest, eventType: string, detail: string, identity?: string) {
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

export async function GET(req: NextRequest) {
  const config = getGoogleAuthConfig(req.nextUrl.origin);
  const stateCookie = req.cookies.get(STATE_COOKIE_NAME)?.value;
  const nextPath = safeNextPath(req.cookies.get(NEXT_COOKIE_NAME)?.value);
  const queryState = req.nextUrl.searchParams.get("state")?.trim();
  const code = req.nextUrl.searchParams.get("code")?.trim();
  const oauthError = req.nextUrl.searchParams.get("error")?.trim();

  if (!config.enabled) {
    return redirectWithDeletedState(loginUrl(req, config.reason ?? "Google ไม่พร้อมใช้งาน", nextPath));
  }
  if (oauthError) {
    const context = await recordGoogleSecurityEvent(req, "google_oauth_error", oauthError);
    await notifyTelegramSafe({
      category: "security",
      title: "Google login ไม่สำเร็จ",
      details: { สาเหตุ: oauthError, ...context },
    });
    return redirectWithDeletedState(loginUrl(req, `Google OAuth เกิดข้อผิดพลาด: ${oauthError}`, nextPath));
  }
  if (!stateCookie || !queryState || stateCookie !== queryState) {
    const context = await recordGoogleSecurityEvent(req, "google_oauth_state_mismatch", "OAuth state ไม่ถูกต้อง");
    await notifyTelegramSafe({
      category: "security",
      title: "ตรวจพบ Google OAuth state ไม่ถูกต้อง",
      details: context,
    });
    return redirectWithDeletedState(loginUrl(req, "เซสชัน Google ไม่ถูกต้อง กรุณาลองใหม่", nextPath));
  }
  if (!code) {
    return redirectWithDeletedState(loginUrl(req, "ไม่พบรหัสยืนยันจาก Google กรุณาลองใหม่", nextPath));
  }

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error(`แลก token กับ Google ไม่สำเร็จ (${tokenResponse.status})`);

    const token = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!token.access_token) throw new Error("Google ไม่ส่ง access token");

    const userInfoResponse = await fetch(config.userInfoUrl, {
      headers: { authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userInfoResponse.ok) throw new Error(`อ่านข้อมูลบัญชี Google ไม่สำเร็จ (${userInfoResponse.status})`);

    const profile = (await userInfoResponse.json()) as GoogleUserInfo;
    const googleSub = profile.sub?.trim() ?? "";
    const email = profile.email?.trim().toLowerCase() ?? "";
    const displayName = normalizeDisplayName(profile.name ?? "") || email;

    if (!googleSub || !email || !profile.email_verified) {
      throw new Error("บัญชี Google ต้องมีอีเมลที่ยืนยันแล้ว");
    }

    let user = await findUserByGoogleSub(googleSub);
    if (!user) {
      user = await findUserByEmail(email);
      if (user) {
        if (user.google_sub && user.google_sub !== googleSub) {
          throw new Error("อีเมลนี้ผูกกับบัญชี Google อื่นแล้ว");
        }
        await linkGoogleIdentity(user.id, googleSub);
      }
    }

    if (user) {
      if (!user.is_active) {
        const context = await recordGoogleSecurityEvent(req, "login_pending_account", "Google", email);
        await notifyTelegramSafe({
          category: "security",
          title: "บัญชีที่ยังไม่ได้รับอนุมัติพยายามเข้าสู่ระบบ",
          details: { ผู้ใช้: user.full_name, อีเมล: email, วิธี: "Google", ...context },
        });
        return redirectWithDeletedState(new URL("/pending-approval", req.url));
      }
      await clearPendingRegistrationClaim();
      await createSession(user.id);
      await notifyTelegramSafe({
        category: "security",
        title: "เข้าสู่ระบบสำเร็จ",
        details: { ผู้ใช้: user.full_name, อีเมล: email, วิธี: "Google", ...requestDetails(req) },
      });
      return redirectWithDeletedState(new URL(nextPath, req.url));
    }

    await setPendingGoogleRegistrationClaim(googleSub, email, displayName);
    const registerUrl = new URL("/register", req.url);
    registerUrl.searchParams.set("notice", "ไม่พบอีเมลนี้ในระบบ กรุณากรอกข้อมูลลงทะเบียนครั้งแรก");
    return redirectWithDeletedState(registerUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบด้วย Google ได้";
    const context = await recordGoogleSecurityEvent(req, "google_login_failed", message);
    await notifyTelegramSafe({
      category: "security",
      title: "Google login ไม่สำเร็จ",
      details: { สาเหตุ: message, ...context },
    });
    return redirectWithDeletedState(loginUrl(req, message, nextPath));
  }
}
