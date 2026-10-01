import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getPublicRequestUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(getPublicRequestUrl(request, withBasePath("/login?notice=ออกจากระบบเรียบร้อยแล้ว")));
}
