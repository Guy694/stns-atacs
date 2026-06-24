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

export function assetStatusLabel(status: string | null | undefined) {
  if (!status) return "-";
  return ASSET_STATUS_LABELS[status] ?? status;
}

export function assetStatusTone(status: string | null | undefined): "success" | "danger" | "warning" | "neutral" {
  if (!status) return "neutral";
  return ASSET_STATUS_TONES[status as keyof typeof ASSET_STATUS_TONES] ?? "neutral";
}
