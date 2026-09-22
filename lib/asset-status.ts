export const ASSET_STATUS_LABELS: Record<string, string> = {
  Active: "พร้อมใช้งาน",
  Inactive: "ไม่ใช้งาน",
  Broken: "ชำรุด",
  Disposed: "จำหน่ายแล้ว",
  Lost: "สูญหาย",
};

export const ASSET_STATUS_TONES = {
  Active: "success",
  Inactive: "warning",
  Broken: "danger",
  Disposed: "neutral",
  Lost: "danger",
} as const;

/** Statuses users may set directly from forms, imports and inspections. */
export const OPERATIONAL_ASSET_STATUSES = ["Active", "Inactive", "Broken"] as const;
/** Statuses reached only through an approved disposal/loss request. */
export const TERMINAL_ASSET_STATUSES = ["Disposed", "Lost"] as const;

export function isTerminalAssetStatus(status: string | null | undefined) {
  return (TERMINAL_ASSET_STATUSES as readonly string[]).includes(status ?? "");
}

export function assetStatusLabel(status: string | null | undefined) {
  if (!status) return "-";
  return ASSET_STATUS_LABELS[status] ?? status;
}

export function assetStatusTone(status: string | null | undefined): "success" | "danger" | "warning" | "neutral" {
  if (!status) return "neutral";
  return ASSET_STATUS_TONES[status as keyof typeof ASSET_STATUS_TONES] ?? "neutral";
}
