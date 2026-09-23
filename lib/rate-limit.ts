/**
 * ตัวจำกัดอัตราแบบ sliding window เก็บในหน่วยความจำของโปรเซส
 * เหมาะกับระบบที่รันคอนเทนเนอร์เดียว (ATACS บน Docker) — ไม่ได้แชร์ข้ามอินสแตนซ์
 * ใช้เป็นด่านแรกเท่านั้น การตรวจสิทธิ์จริงยังอยู่ที่ชั้นข้อมูล
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((at) => now - at < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }

  bucket.hits.push(now);
  if (!buckets.has(key) && buckets.size >= MAX_KEYS) {
    // กันหน่วยความจำโตไม่จำกัดเมื่อถูกยิงด้วยคีย์สุ่ม: ล้างรายการที่หมดอายุแล้วทิ้ง
    for (const [existingKey, existing] of buckets) {
      if (existing.hits.every((at) => now - at >= windowMs)) buckets.delete(existingKey);
    }
  }
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** สำหรับเทสต์เท่านั้น */
export function resetRateLimits() {
  buckets.clear();
}
