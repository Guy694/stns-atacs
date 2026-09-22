"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelLoan, createLoan, getLoan, returnLoan } from "@/lib/asset-loans";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById } from "@/lib/assets";
import { writeAuditLog } from "@/lib/audit";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { friendlyLifecycleError } from "@/lib/schema-errors";

const text = (fd: FormData, key: string) => (fd.get(key) as string | null)?.trim() ?? "";
const migrationHint = (error: unknown) => friendlyLifecycleError(error).replace("add_asset_lifecycle.sql", "add_registry_completeness.sql");

async function requireLoanManager() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "loans.manage"))) return { user, allowed: false as const };
  return { user, allowed: true as const };
}

function revalidateLoan(assetId: number) {
  revalidatePath("/loans");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/dashboard");
}

export async function createLoanAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const { user, allowed } = await requireLoanManager();
  if (!allowed) return "คุณไม่มีสิทธิ์บันทึกการยืม";
  const assetId = Number(fd.get("assetId"));
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return "ไม่พบทรัพย์สิน";
  try {
    const asset = await getAssetById(assetId);
    if (!asset) return "ไม่พบทรัพย์สิน";
    if (!canManageAssetRecord(user, asset.facilityId)) return "คุณไม่มีสิทธิ์ให้ยืมทรัพย์สินของหน่วยงานนี้";
    const result = await createLoan({
      assetId,
      borrowerName: text(fd, "borrowerName"),
      borrowerUnit: text(fd, "borrowerUnit"),
      borrowerContact: text(fd, "borrowerContact"),
      purpose: text(fd, "purpose"),
      loanedOn: text(fd, "loanedOn"),
      dueOn: text(fd, "dueOn"),
      userId: user.id,
      userName: user.fullName,
    });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "asset_loans", entityId: result.loanId, summary: `${asset.assetName}: ${result.note}` });
    revalidateLoan(assetId);
  } catch (error) {
    return migrationHint(error);
  }
  redirect("/loans");
}

export async function returnLoanAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const { user, allowed } = await requireLoanManager();
  if (!allowed) return "คุณไม่มีสิทธิ์บันทึกการรับคืน";
  const loanId = Number(fd.get("loanId"));
  if (!Number.isSafeInteger(loanId) || loanId <= 0) return "ไม่พบรายการยืม";
  try {
    const loan = await getLoan(loanId);
    if (!loan) return "ไม่พบรายการยืม";
    if (!canManageAssetRecord(user, loan.facilityId)) return "คุณไม่มีสิทธิ์รับคืนทรัพย์สินของหน่วยงานนี้";
    const result = await returnLoan({ loanId, returnedOn: text(fd, "returnedOn"), condition: text(fd, "condition"), note: text(fd, "returnNote"), userId: user.id, userName: user.fullName });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "asset_loans", entityId: loanId, summary: `${loan.assetName}: ${result.note}` });
    revalidateLoan(result.assetId);
    if (result.markedBroken) revalidatePath("/repairs");
  } catch (error) {
    return migrationHint(error);
  }
  return "saved";
}

export async function cancelLoanAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const { user, allowed } = await requireLoanManager();
  if (!allowed) return "คุณไม่มีสิทธิ์ยกเลิกรายการยืม";
  const loanId = Number(fd.get("loanId"));
  if (!Number.isSafeInteger(loanId) || loanId <= 0) return "ไม่พบรายการยืม";
  try {
    const loan = await getLoan(loanId);
    if (!loan) return "ไม่พบรายการยืม";
    if (!canManageAssetRecord(user, loan.facilityId)) return "คุณไม่มีสิทธิ์ยกเลิกรายการของหน่วยงานนี้";
    const result = await cancelLoan({ loanId, userId: user.id, userName: user.fullName });
    await writeAuditLog({ userId: user.id, userName: user.fullName, action: "update", entity: "asset_loans", entityId: loanId, summary: `ยกเลิกรายการยืม #${loanId} ${loan.assetName}` });
    revalidateLoan(result.assetId);
  } catch (error) {
    return migrationHint(error);
  }
  return "saved";
}
