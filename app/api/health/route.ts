import { NextResponse } from "next/server";

import { APP_VERSION } from "@/lib/app-version";
import { probeDatabase } from "@/lib/system-health-probe";
import { healthResponse } from "@/lib/system-health";

export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe for the uptime watchdog (stn-atacs-watchdog) and external monitors.
 * Deliberately reveals nothing beyond up/down and database latency.
 */
export async function GET() {
  const db = await probeDatabase();
  const { status, httpStatus } = healthResponse({ dbOk: db.ok, dbMs: db.ms });
  return NextResponse.json(
    { status, db: db.ok ? "ok" : "down", dbMs: db.ms, version: APP_VERSION, time: new Date().toISOString() },
    { status: httpStatus, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
