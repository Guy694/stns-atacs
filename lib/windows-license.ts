export const WINDOWS_LICENSE_STATUS_VALUES = ["Genuine", "Pirated"] as const;

export type WindowsLicenseStatus = (typeof WINDOWS_LICENSE_STATUS_VALUES)[number];

export function windowsLicenseStatusLabel(status: WindowsLicenseStatus | null | undefined) {
  if (status === "Genuine") return "Windows แท้";
  if (status === "Pirated") return "Windows เถื่อน";
  return "";
}

export function isComputerDeviceType(deviceType: string | null | undefined) {
  const normalized = (deviceType ?? "").trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("คอมพิวเตอร์") ||
    /\b(computer|desktop|notebook|laptop|workstation|pc)\b/.test(normalized)
  );
}
