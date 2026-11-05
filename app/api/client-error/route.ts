import { NextRequest, NextResponse } from "next/server";

import { reportServerError } from "@/lib/error-reporting";
import { parseClientErrorBody } from "@/lib/input-guards";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRequestIp } from "@/lib/security";

const MAX_BODY_BYTES = 8 * 1024;

/** รับรายงานข้อผิดพลาดจากเบราว์เซอร์ (error boundary) — จำกัดอัตราและรับเฉพาะคำขอจากหน้าเว็บของเราเอง */
export async function POST(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return NextResponse.json({ ok: false }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415 });
  }
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const ip = readRequestIp(req.headers) ?? "unknown";
  if (!consumeRateLimit(`client-error:${ip}`, 20, 10 * 60 * 1000).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // B8: null / arrays / wrong field types are a bad request, not a server error.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const body = parseClientErrorBody(parsed);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const error = new Error(body.message);
  error.name = body.name;

  await reportServerError({
    error,
    where: `client:${body.where}`,
    path: body.path,
    extra: { digest: body.digest },
  });

  return NextResponse.json({ ok: true });
}
