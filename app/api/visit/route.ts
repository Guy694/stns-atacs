import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { APP_BASE_PATH } from "@/lib/base-path";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRequestIp } from "@/lib/security";
import { areaOf, cleanPath, describeUserAgent, geoFromHeaders, referrerHost } from "@/lib/visitor-log";
import { ensureIpGeo, recordVisit } from "@/lib/visitor-log-data";

export const dynamic = "force-dynamic";

const NO_CONTENT = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * Page-view beacon from app/_components/visit-beacon.tsx. Always answers 204 (never reveals why a visit was
 * not stored) and never slows the page: IP location is resolved in the background.
 */
export async function POST(req: NextRequest) {
  // Only our own pages may report visits (blocks cross-site log spam).
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NO_CONTENT();
    } catch {
      return NO_CONTENT();
    }
  }

  const ip = readRequestIp(req.headers) ?? "unknown";
  if (!consumeRateLimit(`visit:${ip}`, 120, 10 * 60 * 1000).allowed) return NO_CONTENT();

  let body: { path?: unknown; referrer?: unknown } = {};
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as typeof body;
  } catch {
    return NO_CONTENT();
  }
  const path = cleanPath(typeof body.path === "string" ? body.path : "", APP_BASE_PATH);
  if (!path) return NO_CONTENT();

  const userAgent = req.headers.get("user-agent") ?? "";
  const { device, browser, bot } = describeUserAgent(userAgent);
  const user = await getCurrentUser().catch(() => null);
  try {
    await recordVisit({
      ip,
      area: areaOf(path),
      path,
      referrerHost: referrerHost(typeof body.referrer === "string" ? body.referrer : "", (host ?? "").split(":")[0]),
      user: user ? { id: user.id, fullName: user.fullName, role: user.role } : null,
      device,
      browser,
      bot,
      userAgent,
    });
    void ensureIpGeo(ip, geoFromHeaders(req.headers));
  } catch (error) {
    // Table missing (migration not run) or DB hiccup: the page must not care.
    console.error("[visit] could not record", error instanceof Error ? error.message : error);
  }
  return NO_CONTENT();
}
