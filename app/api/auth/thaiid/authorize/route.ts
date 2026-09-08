import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getThaiIdConfig } from "@/lib/thaiid";

const STATE_COOKIE_NAME = "atacs_thaid_state";

function toLoginUrl(req: NextRequest, search: Record<string, string>) {
  const url = new URL("/login", req.url);
  for (const [key, value] of Object.entries(search)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(req: NextRequest) {
  const config = await getThaiIdConfig(req.nextUrl.origin);

  if (!config.enabled) {
    return NextResponse.redirect(
      toLoginUrl(req, {
        error: config.reason ?? "ThaiD ไม่พร้อมใช้งาน",
        tab: "password",
      })
    );
  }

  const state = `${crypto.randomUUID()}-${crypto.randomBytes(8).toString("hex")}`;
  const authUrl = new URL(config.authorizeUrl);

  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authUrl.searchParams.set("scope", "pid given_name family_name");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
