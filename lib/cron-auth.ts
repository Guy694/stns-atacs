import { createHash, timingSafeEqual } from "node:crypto";

/**
 * ตรวจ header Authorization ของงานตั้งเวลา (cron) เทียบกับ CRON_SECRET แบบเวลาคงที่
 * (hash ทั้งสองฝั่งก่อน จึงไม่รั่วความยาวหรือตำแหน่งที่ต่างกัน) ไม่ตั้ง CRON_SECRET = ปฏิเสธทุกคำขอ
 */
export function isAuthorizedCronHeader(authorization: string | null | undefined, secret = process.env.CRON_SECRET) {
  const expected = secret?.trim();
  if (!expected || !authorization) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${expected}`));
}
