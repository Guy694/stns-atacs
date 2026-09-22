/** Methods follow ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 (หมวด 9 การจำหน่ายพัสดุ). */
export const DISPOSAL_METHODS = [
  { value: "Sale", label: "ขาย (ขายทอดตลาด / ตกลงราคา / ขายให้หน่วยงานรัฐ)" },
  { value: "Exchange", label: "แลกเปลี่ยน" },
  { value: "Transfer", label: "โอนให้หน่วยงานของรัฐหรือองค์กรสาธารณกุศล" },
  { value: "Destroy", label: "แปรสภาพหรือทำลาย" },
  { value: "WriteOff", label: "จำหน่ายเป็นสูญ" },
] as const;

export type DisposalMethod = (typeof DISPOSAL_METHODS)[number]["value"];
export type DisposalRequestType = "Disposed" | "Lost";
export type DisposalRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export const DISPOSAL_REQUEST_TYPE_LABELS: Record<DisposalRequestType, string> = {
  Disposed: "จำหน่ายออก",
  Lost: "สูญหาย",
};

export const DISPOSAL_STATUS_LABELS: Record<DisposalRequestStatus, string> = {
  Pending: "รออนุมัติ",
  Approved: "อนุมัติแล้ว",
  Rejected: "ไม่อนุมัติ",
  Cancelled: "ยกเลิก",
};

export const DISPOSAL_STATUS_TONES: Record<DisposalRequestStatus, "warning" | "success" | "danger" | "neutral"> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  Cancelled: "neutral",
};

export function disposalMethodLabel(value?: string | null) {
  return DISPOSAL_METHODS.find(method => method.value === value)?.label ?? "-";
}

export function isDisposalMethod(value: string): value is DisposalMethod {
  return DISPOSAL_METHODS.some(method => method.value === value);
}
