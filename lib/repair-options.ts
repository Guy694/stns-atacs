export const REPAIR_STATUSES = ["Reported", "InProgress", "SentToVendor", "Completed", "Cancelled"] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];
export const OPEN_REPAIR_STATUSES: RepairStatus[] = ["Reported", "InProgress", "SentToVendor"];

export const REPAIR_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number];

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  Reported: "รับแจ้ง",
  InProgress: "กำลังซ่อม",
  SentToVendor: "ส่งซ่อมภายนอก",
  Completed: "ซ่อมเสร็จ",
  Cancelled: "ยกเลิก",
};

export const REPAIR_STATUS_TONES: Record<RepairStatus, "warning" | "info" | "primary" | "success" | "neutral"> = {
  Reported: "warning",
  InProgress: "info",
  SentToVendor: "primary",
  Completed: "success",
  Cancelled: "neutral",
};

export const REPAIR_PRIORITY_LABELS: Record<RepairPriority, string> = {
  Low: "ต่ำ",
  Normal: "ปกติ",
  High: "สูง",
  Urgent: "เร่งด่วน",
};

export const REPAIR_PRIORITY_TONES: Record<RepairPriority, "neutral" | "info" | "warning" | "danger"> = {
  Low: "neutral",
  Normal: "info",
  High: "warning",
  Urgent: "danger",
};

/** Allowed next statuses. Completed and Cancelled close the job. */
export const REPAIR_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  Reported: ["InProgress", "SentToVendor", "Completed", "Cancelled"],
  InProgress: ["SentToVendor", "Completed", "Cancelled"],
  SentToVendor: ["InProgress", "Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export function isOpenRepairStatus(status: string) {
  return (OPEN_REPAIR_STATUSES as string[]).includes(status);
}

export function canTransitionRepair(from: RepairStatus, to: RepairStatus) {
  return from === to ? isOpenRepairStatus(from) : REPAIR_TRANSITIONS[from].includes(to);
}
