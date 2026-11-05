/**
 * อ่าน body ของคำขอจาก Agent แบบจำกัดขนาด (G11/G12, SEC-15)
 * อ่านทีละ chunk และหยุดทันทีเมื่อเกินเพดาน ไม่โหลดทั้ง body เข้าหน่วยความจำก่อนตรวจ
 * (content-length ปลอมหรือ chunked encoding ข้ามการตรวจ header ได้)
 */

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413; error: string };

export async function readLimitedText(req: Request, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  if (!req.body) return { ok: true, text: "" };

  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false };
    }
    chunks.push(Buffer.from(value));
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}

export async function readJsonBody(req: Request, maxBytes: number): Promise<JsonBodyResult> {
  let read: Awaited<ReturnType<typeof readLimitedText>>;
  try {
    read = await readLimitedText(req, maxBytes);
  } catch {
    return { ok: false, status: 400, error: "Unable to read request body" };
  }
  if (!read.ok) return { ok: false, status: 413, error: "Payload too large" };
  try {
    return { ok: true, value: JSON.parse(read.text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }
}

/** ใช้แยก "ส่งค่าผิดชนิดมา" ออกจาก "ไม่ได้ส่งมา" */
export const INVALID = Symbol("invalid");

/** string -> string, ไม่ส่ง/null -> undefined, ชนิดอื่น -> INVALID */
export function optionalString(value: unknown): string | undefined | typeof INVALID {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : INVALID;
}

/** number หรือ string ตัวเลข -> number, ไม่ส่ง/null/"" -> undefined, อื่น ๆ -> INVALID */
export function optionalInteger(value: unknown): number | undefined | typeof INVALID {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" && typeof value !== "string") return INVALID;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : INVALID;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
