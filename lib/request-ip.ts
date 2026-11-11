/** Pure: no database or network, so lib/auth can use it without import cycles. */
export function normalizeIp(value?: string | null) {
  return value?.split(",")[0]?.trim().slice(0, 45) || "unknown";
}

/**
 * SEC-08: อ่าน IP ของผู้ใช้จริงจาก X-Forwarded-For อย่างปลอดภัย
 *
 * X-Forwarded-For เป็นรายการที่ proxy แต่ละชั้น "ต่อท้าย" IP ที่ตัวเองเห็น
 * ดังนั้นรายการท้าย ๆ มาจาก proxy ที่เราเชื่อถือ ส่วนรายการแรก ๆ ไคลเอนต์ปลอมได้
 * จึงนับถอยหลังจากท้ายตามจำนวนชั้น proxy ที่ตั้งค่าไว้ (TRUSTED_PROXY_COUNT)
 *
 *   TRUSTED_PROXY_COUNT=2  (เช่น Caddy/Nginx ของเซิร์ฟเวอร์ + proxy ของโดเมนอีกชั้น)
 *   ไม่ตั้งค่า / 0          = ไม่เชื่อค่าที่ไคลเอนต์ส่งมาเลย ใช้ IP ของ hop ที่ใกล้ที่สุด
 *                            (ปลอมไม่ได้ แต่ถ้ามี proxy จะได้ IP ของ proxy แทนผู้ใช้จริง)
 */
type ProxyEnv = { TRUSTED_PROXY_COUNT?: string };

export function readRequestIp(headers: Headers, env: ProxyEnv = process.env as ProxyEnv) {
  const forwarded = headers.get("x-forwarded-for");
  const parts = (forwarded ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return normalizeIp(headers.get("x-real-ip"));

  const configured = Number(env.TRUSTED_PROXY_COUNT ?? 0);
  const trusted = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 0;
  if (trusted === 0) return normalizeIp(parts[parts.length - 1]);

  // นับถอยหลัง: ชั้นที่เชื่อถือได้เป็นรายการท้ายสุด ผู้ใช้จริงอยู่ก่อนหน้านั้น
  const index = Math.max(0, parts.length - trusted);
  return normalizeIp(parts[index]);
}
