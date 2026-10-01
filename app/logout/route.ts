import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getPublicRequestUrl } from "@/lib/request-url";
import { secureCookiesEnabled } from "@/lib/cookie-security";

export async function POST(request: Request) {
  await destroySession();
  // POST/Redirect/GET: 303 forces the browser to open the login page with GET.
  const loginPath = withBasePath(`/login/?notice=${encodeURIComponent("ออกจากระบบเรียบร้อยแล้ว")}`);
  const response = NextResponse.redirect(getPublicRequestUrl(request, loginPath), 303);
  response.headers.set("cache-control", "no-store");

  response.cookies.set("atacs_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
