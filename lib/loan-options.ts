/** Loans (ยืม-คืน): statuses and the pure rules shared by the server and the forms. */
export type LoanStatus = "OnLoan" | "Returned" | "Cancelled";
export type LoanState = "on-loan" | "due-soon" | "overdue" | "returned" | "cancelled";
export type ReturnCondition = "Good" | "Damaged";

export const LOAN_STATE_LABELS: Record<LoanState, string> = {
  "on-loan": "ยืมอยู่",
  "due-soon": "ใกล้ครบกำหนดคืน",
  overdue: "เกินกำหนดคืน",
  returned: "คืนแล้ว",
  cancelled: "ยกเลิก",
};

export const LOAN_STATE_TONES: Record<LoanState, "info" | "warning" | "danger" | "success" | "neutral"> = {
  "on-loan": "info",
  "due-soon": "warning",
  overdue: "danger",
  returned: "success",
  cancelled: "neutral",
};

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = { Good: "สภาพปกติ", Damaged: "ชำรุด" };

export const LOAN_DUE_SOON_DAYS = 3;
export const LOAN_MAX_DAYS = 366;

const DAY = 86_400_000;
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const days = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY);

export function loanState(loan: { status: LoanStatus; dueOn: string }, today = new Date().toISOString().slice(0, 10)): { state: LoanState; daysLeft: number } {
  if (loan.status === "Returned") return { state: "returned", daysLeft: 0 };
  if (loan.status === "Cancelled") return { state: "cancelled", daysLeft: 0 };
  const daysLeft = days(today, loan.dueOn);
  if (daysLeft < 0) return { state: "overdue", daysLeft };
  if (daysLeft <= LOAN_DUE_SOON_DAYS) return { state: "due-soon", daysLeft };
  return { state: "on-loan", daysLeft };
}

export type LoanInput = { borrowerName: string; borrowerUnit?: string; borrowerContact?: string; purpose: string; loanedOn: string; dueOn: string };

export function validateLoanInput(input: LoanInput, today = new Date().toISOString().slice(0, 10)) {
  const borrowerName = input.borrowerName.trim();
  const purpose = input.purpose.trim();
  if (!borrowerName) throw new Error("กรุณาระบุชื่อผู้ยืม");
  if (borrowerName.length > 255 || (input.borrowerUnit ?? "").trim().length > 255 || (input.borrowerContact ?? "").trim().length > 255) throw new Error("ข้อมูลผู้ยืมยาวเกิน 255 ตัวอักษร");
  if (!purpose) throw new Error("กรุณาระบุวัตถุประสงค์การยืม");
  if (purpose.length > 2000) throw new Error("วัตถุประสงค์ยาวเกิน 2,000 ตัวอักษร");
  if (!isDate(input.loanedOn) || input.loanedOn > today) throw new Error("วันที่ยืมไม่ถูกต้องหรือเกินวันที่ปัจจุบัน");
  if (!isDate(input.dueOn) || input.dueOn < input.loanedOn) throw new Error("กำหนดคืนต้องไม่ก่อนวันที่ยืม");
  if (days(input.loanedOn, input.dueOn) > LOAN_MAX_DAYS) throw new Error("ระยะเวลายืมต้องไม่เกิน 1 ปี หากใช้งานถาวรให้โอนย้ายแทน");
  return {
    borrowerName,
    borrowerUnit: (input.borrowerUnit ?? "").trim(),
    borrowerContact: (input.borrowerContact ?? "").trim(),
    purpose,
    loanedOn: input.loanedOn,
    dueOn: input.dueOn,
  };
}

export function validateReturn(input: { returnedOn: string; condition: string; loanedOn: string }, today = new Date().toISOString().slice(0, 10)) {
  if (!isDate(input.returnedOn) || input.returnedOn > today) throw new Error("วันที่คืนไม่ถูกต้องหรือเกินวันที่ปัจจุบัน");
  if (input.returnedOn < input.loanedOn) throw new Error("วันที่คืนต้องไม่ก่อนวันที่ยืม");
  if (input.condition !== "Good" && input.condition !== "Damaged") throw new Error("กรุณาเลือกสภาพเมื่อรับคืน");
  return input.condition as ReturnCondition;
}
