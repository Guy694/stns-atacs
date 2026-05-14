import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login?notice=ออกจากระบบเรียบร้อยแล้ว", request.url));
}
