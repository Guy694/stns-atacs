import { NextRequest, NextResponse } from "next/server";

import { collectDailySummary } from "@/lib/daily-summary";
import { buildDailySummaryDetails, dailySummaryEventKey, hasSummaryContent, summaryThresholdsFromEnv } from "@/lib/daily-summary-format";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";
import { notifyTelegramSafe } from "@/lib/telegram";
import { isAuthorizedCronHeader } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-status";
import { purgeOldVisitorData } from "@/lib/visitor-log-data";
import { buildWeeklySecurityDetails, weeklyReportDay, weeklyReportEventKey, weeklyReportPeriod } from "@/lib/security-weekly";
import { collectWeeklySecurity } from "@/lib/security-weekly-data";

/** N4: รายงานความปลอดภัยรายสัปดาห์ (วันจันทร์ หรือ SECURITY_WEEKLY_REPORT_DAY) — ส่งครั้งเดียวต่อวันตาม eventKey */
async function sendWeeklySecurityReport(today: string, force: boolean, dry: boolean) {
  const period = weeklyReportPeriod(today, weeklyReportDay(process.env));
  if (!period.due && !force) return { due: false as const };
  const data = await collectWeeklySecurity(period.start, period.end);
  const details = buildWeeklySecurityDetails(data);
  if (dry) return { due: true as const, data, details };
  const result = await notifyTelegramSafe({
    category: "security",
    title: "🛡️ รายงานความปลอดภัย ATACS ประจำสัปดาห์",
    eventKey: weeklyReportEventKey(today),
    details,
  });
  await recordCronRun("security-weekly", result.sent !== false, result.sent ? `ส่งรายงาน ${period.start} ถึง ${period.end}` : "ส่ง Telegram ไม่สำเร็จ");
  return { due: true as const, sent: result.sent };
}

function isAuthorized(req: NextRequest) {
  return isAuthorizedCronHeader(req.headers.get("authorization"));
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

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const forceWeekly = req.nextUrl.searchParams.get("weekly") === "1";
  // ส่งรายงานรายสัปดาห์ก่อน ไม่ให้ถูกข้ามเมื่อไม่มีงานค้างประจำวัน และไม่ให้สรุปรายวันล้มถ้ารายงานสัปดาห์มีปัญหา
  const weekly = await sendWeeklySecurityReport(today, forceWeekly, dry).catch((error) => {
    console.error("[cron] security weekly failed", error instanceof Error ? error.message : error);
    return { due: true as const, error: "failed" };
  });

  if (dry) return NextResponse.json({ ok: true, date: today, counts, data, weekly });

  // เก็บประวัติผู้เข้าชม 90 วัน (VISITOR_LOG_RETENTION_DAYS) — ไม่ให้งานสรุปล้มถ้ายังไม่ได้รัน migration
  await purgeOldVisitorData().catch((error) => console.error("[cron] visitor purge failed", error instanceof Error ? error.message : error));
  if (!hasSummaryContent(data)) {
    await recordCronRun("daily-summary", true, "ไม่มีงานค้าง");
    return NextResponse.json({ ok: true, date: today, counts, sent: false, reason: "nothing-to-report", weekly });
  }

  const result = await notifyTelegramSafe({
    category: "lifecycle",
    title: `สรุปงานที่ต้องติดตาม ประจำวันที่ ${today}`,
    eventKey: dailySummaryEventKey(today),
    details: buildDailySummaryDetails(data, thresholds),
  });
  await recordCronRun("daily-summary", result.sent !== false, result.sent ? "ส่งสรุปทาง Telegram แล้ว" : "ส่ง Telegram ไม่สำเร็จ");
  return NextResponse.json({ ok: true, date: today, counts, sent: result.sent, weekly });
}
