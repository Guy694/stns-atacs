import "server-only";

import { formatThaiDateTime } from "@/lib/date-format";
import { executeStatement } from "@/lib/mysql";

export type TelegramAlertCategory = "security" | "registration" | "data" | "agent" | "lifecycle" | "error";

type TelegramAlertInput = {
  category: TelegramAlertCategory;
  title: string;
  details?: Record<string, string | number | boolean | null | undefined>;
  eventKey?: string;
};

const CATEGORY_META: Record<TelegramAlertCategory, { icon: string; label: string; level: string }> = {
  security: { icon: "🚨", label: "ความปลอดภัย", level: "ตรวจสอบทันที" },
  registration: { icon: "👤", label: "ลงทะเบียนผู้ใช้งาน", level: "รอดำเนินการ" },
  data: { icon: "📝", label: "บันทึกข้อมูล", level: "กิจกรรมระบบ" },
  agent: { icon: "🖥️", label: "ATACS Agent", level: "สถานะอุปกรณ์" },
  lifecycle: { icon: "📦", label: "งานทะเบียนครุภัณฑ์", level: "ติดตามการดำเนินงาน" },
  error: { icon: "💥", label: "ข้อผิดพลาดของระบบ", level: "ตรวจสอบเมื่อสะดวก" },
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .slice(0, 600)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isCategoryEnabled(category: TelegramAlertCategory) {
  const globalFlag = (process.env.TELEGRAM_ALERTS_ENABLED ?? "true").trim().toLowerCase();
  if (["0", "false", "off"].includes(globalFlag)) return false;

  const categoryFlag = process.env[`TELEGRAM_ALERT_${category.toUpperCase()}`]?.trim().toLowerCase();
  return !categoryFlag || !["0", "false", "off"].includes(categoryFlag);
}

function buildMessage(input: TelegramAlertInput) {
  const meta = CATEGORY_META[input.category];
  const details = Object.entries(input.details ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  const lines = [
    `${meta.icon} <b>ATACS • ${escapeHtml(meta.label)}</b>`,
    `<b>${escapeHtml(input.title)}</b>`,
    `<i>${escapeHtml(meta.level)}</i>`,
  ];

  if (details.length > 0) {
    lines.push("");
    for (const [label, value] of details) {
      lines.push(`• <b>${escapeHtml(label)}</b>\n  ${escapeHtml(value)}`);
    }
  }

  lines.push("");
  lines.push(`🕒 ${escapeHtml(formatThaiDateTime(new Date()))}`);
  return lines.join("\n");
}

async function reserveEvent(eventKey: string) {
  const result = await executeStatement(
    `INSERT IGNORE INTO telegram_alert_events (event_key, created_at) VALUES (?, NOW())`,
    [eventKey]
  );
  return result.affectedRows === 1;
}

async function releaseEvent(eventKey: string) {
  await executeStatement("DELETE FROM telegram_alert_events WHERE event_key = ?", [eventKey]);
}

export async function sendTelegramAlert(input: TelegramAlertInput) {
  if (!isCategoryEnabled(input.category)) return { sent: false, reason: "disabled" };

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return { sent: false, reason: "not-configured" };

  let reserved = false;
  if (input.eventKey) {
    reserved = await reserveEvent(input.eventKey);
    if (!reserved) return { sent: false, reason: "duplicate" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number(process.env.TELEGRAM_TIMEOUT_MS ?? 5000));

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(input),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Telegram API returned ${response.status}`);
    }
    return { sent: true, reason: null };
  } catch (error) {
    if (reserved && input.eventKey) {
      await releaseEvent(input.eventKey);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function notifyTelegramSafe(input: TelegramAlertInput) {
  try {
    return await sendTelegramAlert(input);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.error(`Telegram alert failed (${reason})`);
    return { sent: false, reason: "failed" };
  }
}
