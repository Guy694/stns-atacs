import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL(withBasePath("/login?notice=ออกจากระบบเรียบร้อยแล้ว"), request.url));
}
