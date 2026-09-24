import { NextRequest, NextResponse } from "next/server";

import { reportServerError } from "@/lib/error-reporting";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRequestIp } from "@/lib/security";

type ClientErrorBody = {
  where?: string;
  name?: string;
  message?: string;
  digest?: string;
  path?: string | null;
};

/** รับรายงานข้อผิดพลาดจากเบราว์เซอร์ (error boundary) — จำกัดอัตราและรับเฉพาะคำขอจากหน้าเว็บของเราเอง */
export async function POST(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return NextResponse.json({ ok: false }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415 });
  }

  const ip = readRequestIp(req.headers) ?? "unknown";
  if (!consumeRateLimit(`client-error:${ip}`, 20, 10 * 60 * 1000).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: ClientErrorBody;
  try {
    body = (await req.json()) as ClientErrorBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const error = new Error(String(body.message ?? "").slice(0, 500));
  error.name = String(body.name ?? "Error").slice(0, 100);

  await reportServerError({
    error,
    where: `client:${String(body.where ?? "unknown").slice(0, 50)}`,
    path: typeof body.path === "string" ? body.path.slice(0, 200) : null,
    extra: { digest: body.digest?.slice(0, 100) ?? "-" },
  });

  return NextResponse.json({ ok: true });
}
