import "server-only";

import { errorFingerprint, redactErrorText } from "@/lib/error-fingerprint";
import { consumeRateLimit } from "@/lib/rate-limit";
import { notifyTelegramSafe } from "@/lib/telegram";

/**
 * จุดรวมสำหรับบันทึกข้อผิดพลาดที่เกิดขึ้นจริงในระบบ
 * - เขียน log แบบมีโครงสร้างออก stderr เสมอ (อ่านด้วย `docker compose logs app`)
 * - แจ้ง Telegram หมวด "error" แบบไม่สแปม: ข้อผิดพลาดเดียวกันแจ้งไม่เกิน 1 ครั้งต่อช่วงเวลา
 * - ข้อความถูกลบข้อมูลส่วนบุคคล/ความลับออกก่อนเสมอ
 */
export type ReportedError = {
  where: string;
  error: unknown;
  path?: string | null;
  userId?: number | string | null;
  extra?: Record<string, string | number | null | undefined>;
};

const ALERT_WINDOW_MS = Number(process.env.ERROR_ALERT_WINDOW_MINUTES ?? 30) * 60 * 1000 || 30 * 60 * 1000;

function toParts(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  if (typeof error === "string") return { name: "Error", message: error, stack: undefined };
  return { name: "Error", message: JSON.stringify(error)?.slice(0, 500) ?? "unknown", stack: undefined };
}

export async function reportServerError(input: ReportedError) {
  const parts = toParts(input.error);
  const fingerprint = errorFingerprint({ ...parts, where: input.where });
  const message = redactErrorText(parts.message ?? "");

  console.error(
    JSON.stringify({
      tag: "atacs-error",
      at: new Date().toISOString(),
      where: input.where,
      path: input.path ?? null,
      userId: input.userId ?? null,
      name: parts.name,
      message,
      fingerprint,
      stack: redactErrorText(parts.stack ?? "", 2000),
      ...input.extra,
    })
  );

  const alert = consumeRateLimit(`error-alert:${fingerprint}`, 1, ALERT_WINDOW_MS);
  if (!alert.allowed) return { alerted: false, fingerprint, reason: "deduped" as const };

  const result = await notifyTelegramSafe({
    category: "error",
    title: `ข้อผิดพลาดในระบบ: ${input.where}`,
    details: {
      ข้อความ: message || "(ไม่มีข้อความ)",
      หน้า: input.path ?? "-",
      ผู้ใช้: input.userId ?? "-",
      ...input.extra,
    },
  });
  return { alerted: result.sent, fingerprint, reason: "sent" as const };
}
