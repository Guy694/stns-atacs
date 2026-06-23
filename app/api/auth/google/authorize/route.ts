import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getGoogleAuthConfig } from "@/lib/google-auth";

const STATE_COOKIE_NAME = "atacs_google_state";
const NEXT_COOKIE_NAME = "atacs_google_next";

function safeNextPath(value: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  return value;
}

export async function GET(req: NextRequest) {
  const config = getGoogleAuthConfig(req.nextUrl.origin);
  if (!config.enabled) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(config.reason ?? "Google ไม่พร้อมใช้งาน")}`, req.url));
  }

  const state = `${crypto.randomUUID()}-${crypto.randomBytes(8).toString("hex")}`;
  const nextPath = safeNextPath(req.nextUrl.searchParams.get("next"));
  const authUrl = new URL(config.authorizeUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  response.cookies.set(NEXT_COOKIE_NAME, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
