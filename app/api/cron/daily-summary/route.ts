import { NextRequest, NextResponse } from "next/server";

import { collectDailySummary } from "@/lib/daily-summary";
import { buildDailySummaryDetails, dailySummaryEventKey, hasSummaryContent, summaryThresholdsFromEnv } from "@/lib/daily-summary-format";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Thai calendar date (Asia/Bangkok) regardless of the server time zone. */
function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Called once a day by the cron container (docker-compose) or Vercel Cron.
// Sends at most one Telegram message per day (event key daily-summary:YYYY-MM-DD); ?dry=1 only returns the data.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    await recordSecurityEvent({
      eventType: "cron_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "Authorization header ไม่ถูกต้อง",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = bangkokToday();
  const thresholds = summaryThresholdsFromEnv(process.env);
  const data = await collectDailySummary(today, thresholds);
  const counts = {
    overdueLoans: data.overdueLoans.count,
    inspectionDeadlines: data.inspectionDeadlines.count,
    expiringContracts: data.expiringContracts.count,
    pendingDisposals: data.pendingDisposals.count,
    staleRepairs: data.staleRepairs.count,
  };

  if (req.nextUrl.searchParams.get("dry") === "1") return NextResponse.json({ ok: true, date: today, counts, data });
  if (!hasSummaryContent(data)) return NextResponse.json({ ok: true, date: today, counts, sent: false, reason: "nothing-to-report" });

  const result = await notifyTelegramSafe({
    category: "lifecycle",
    title: `สรุปงานที่ต้องติดตาม ประจำวันที่ ${today}`,
    eventKey: dailySummaryEventKey(today),
    details: buildDailySummaryDetails(data, thresholds),
  });
  return NextResponse.json({ ok: true, date: today, counts, sent: result.sent });
}
