/** True when a query failed because an additive migration has not been applied yet. */
export function isMissingSchemaError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

export const LIFECYCLE_MIGRATION_MESSAGE =
  "ฐานข้อมูลยังไม่มีตารางสำหรับฟังก์ชันนี้ กรุณาให้ผู้ดูแลระบบรัน database/add_asset_lifecycle.sql";

export function friendlyLifecycleError(error: unknown, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่") {
  if (isMissingSchemaError(error)) return LIFECYCLE_MIGRATION_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}
