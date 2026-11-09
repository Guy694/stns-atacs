/** True when a query failed because an additive migration has not been applied yet. */
export function isMissingSchemaError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

export const LIFECYCLE_MIGRATION_MESSAGE =
  "ฐานข้อมูลยังไม่มีตารางสำหรับฟังก์ชันนี้ กรุณาให้ผู้ดูแลระบบรัน database/add_asset_lifecycle.sql";

const DB_MESSAGES: Record<string, string> = {
  ER_DUP_ENTRY: "ข้อมูลซ้ำกับรายการที่มีอยู่แล้ว กรุณาตรวจเลขครุภัณฑ์ / เลขประจำเครื่อง",
  ER_DATA_TOO_LONG: "ข้อมูลบางช่องยาวเกินกำหนด กรุณาตัดให้สั้นลง",
  ER_TRUNCATED_WRONG_VALUE: "รูปแบบข้อมูลไม่ถูกต้อง (เช่น วันที่หรือตัวเลข)",
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: "รูปแบบข้อมูลไม่ถูกต้อง (เช่น วันที่หรือตัวเลข)",
  ER_WARN_DATA_OUT_OF_RANGE: "ตัวเลขมากหรือน้อยเกินกว่าที่ระบบรองรับ",
  ER_BAD_NULL_ERROR: "กรอกข้อมูลที่จำเป็นไม่ครบ",
  ER_NO_REFERENCED_ROW_2: "ข้อมูลที่อ้างถึงไม่มีอยู่แล้ว (อาจถูกลบไป) กรุณารีเฟรชหน้า",
  ER_ROW_IS_REFERENCED_2: "ลบไม่ได้ เพราะมีข้อมูลอื่นอ้างถึงรายการนี้อยู่",
  ER_LOCK_WAIT_TIMEOUT: "ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง",
  ER_LOCK_DEADLOCK: "ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง",
};
const CONNECTION_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "PROTOCOL_CONNECTION_LOST", "ER_CON_COUNT_ERROR"]);

function isDatabaseError(error: unknown): error is Error & { code?: string } {
  if (!(error instanceof Error)) return false;
  const e = error as Error & { code?: unknown; sqlMessage?: unknown; sqlState?: unknown };
  return (
    (typeof e.code === "string" && (e.code.startsWith("ER_") || CONNECTION_CODES.has(e.code))) ||
    typeof e.sqlMessage === "string" ||
    typeof e.sqlState === "string"
  );
}

/**
 * X2: message safe to show a user. Errors we throw on purpose (Thai business rules) pass through;
 * raw MySQL / driver errors are logged server-side and replaced, so table and column names never leak.
 */
export function userFacingError(error: unknown, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่") {
  if (!(error instanceof Error)) return fallback;
  if (!isDatabaseError(error)) return error.message || fallback;
  console.error("[db] request failed:", error);
  if (error.code && CONNECTION_CODES.has(error.code)) return "เชื่อมต่อฐานข้อมูลไม่ได้ชั่วคราว กรุณาลองใหม่ในอีกสักครู่";
  return (error.code && DB_MESSAGES[error.code]) || fallback;
}

export function friendlyLifecycleError(error: unknown, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่") {
  if (isMissingSchemaError(error)) return LIFECYCLE_MIGRATION_MESSAGE;
  return userFacingError(error, fallback);
}
