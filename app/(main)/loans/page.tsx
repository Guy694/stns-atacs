import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { listLoans, type AssetLoan } from "@/lib/asset-loans";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate } from "@/lib/date-format";
import { getAssetFacilityScopeIds } from "@/lib/facility-scope";
import { LOAN_STATE_LABELS, LOAN_STATE_TONES, loanState, RETURN_CONDITION_LABELS } from "@/lib/loan-options";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { CancelLoanButton, ReturnLoanForm } from "./_components/loan-forms";

function LoanState({ loan }: { loan: AssetLoan }) {
  const { state, daysLeft } = loanState(loan);
  const detail = state === "overdue" ? ` ${(-daysLeft).toLocaleString("th-TH")} วัน` : state === "due-soon" ? ` (อีก ${daysLeft.toLocaleString("th-TH")} วัน)` : "";
  return <StatusBadge tone={LOAN_STATE_TONES[state]}>{LOAN_STATE_LABELS[state]}{detail}</StatusBadge>;
}

export default async function LoansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "loans.view"))) redirect("/dashboard");
  const scopeIds = getAssetFacilityScopeIds(user);
  if (scopeIds === null) redirect("/profile");
  const canManage = canMutateAssets(user) && (await hasPermission(user.role, "loans.manage"));

  const [active, history] = await Promise.all([
    listLoans({ facilityIds: scopeIds, status: "OnLoan", limit: 500 }),
    listLoans({ facilityIds: scopeIds, limit: 60 }),
  ]);
  const returned = history.rows.filter((loan) => loan.status !== "OnLoan");
  const overdue = active.rows.filter((loan) => loanState(loan).state === "overdue").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · ยืม-คืน</p>
          <h1 className="section-title mt-1 flex items-center gap-2 text-3xl font-semibold"><AppIcon name="repeat" className="h-7 w-7 text-[var(--primary)]" /> ยืม-คืนครุภัณฑ์</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">ครุภัณฑ์ที่ให้หน่วยงานหรือบุคคลอื่นยืมใช้ชั่วคราว กำหนดคืน และสภาพเมื่อรับคืน</p>
        </div>
        {canManage && <Link href="/loans/new" className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]">+ บันทึกการยืม</Link>}
      </div>

      {!active.schemaReady ? (
        <p className="glass-panel rounded-2xl p-5 text-sm text-amber-700">ยังไม่ได้เปิดใช้การยืม-คืน (ต้องรัน database/add_registry_completeness.sql)</p>
      ) : (
        <>
          <section className="glass-panel overflow-hidden rounded-2xl" aria-labelledby="active-heading">
            <div className="border-b border-black/6 px-5 py-3">
              <h2 id="active-heading" className="font-semibold">กำลังถูกยืม <span className="ml-1 text-sm font-normal text-[var(--muted)]">{active.rows.length} รายการ{overdue ? ` · เกินกำหนด ${overdue}` : ""}</span></h2>
            </div>
            {active.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">ไม่มีครุภัณฑ์ที่ถูกยืมอยู่</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {active.rows.map((loan) => (
                  <li key={loan.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/assets/${loan.assetId}`} className="font-medium hover:underline">{loan.assetName}</Link>
                        <p className="font-mono text-xs text-[var(--muted)]">{loan.assetNumber} · {loan.facilityName}</p>
                        <p className="mt-1 text-sm">ผู้ยืม <b>{loan.borrowerName}</b>{loan.borrowerUnit ? ` · ${loan.borrowerUnit}` : ""}{loan.borrowerContact ? ` · ${loan.borrowerContact}` : ""}</p>
                        <p className="text-xs text-[var(--muted)]">ยืม {formatThaiDate(loan.loanedOn)} · กำหนดคืน {formatThaiDate(loan.dueOn)} · {loan.purpose}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <LoanState loan={loan} />
                        {canManage && canManageAssetRecord(user, loan.facilityId) && <CancelLoanButton loanId={loan.id} />}
                      </div>
                    </div>
                    {canManage && canManageAssetRecord(user, loan.facilityId) && <ReturnLoanForm loanId={loan.id} loanedOn={loan.loanedOn} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass-panel overflow-hidden rounded-2xl" aria-labelledby="history-heading">
            <div className="border-b border-black/6 px-5 py-3"><h2 id="history-heading" className="font-semibold">คืนแล้วล่าสุด</h2></div>
            {returned.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">ยังไม่มีประวัติการคืน</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50/60 text-left text-xs text-[var(--muted)]">
                    <tr>{["ครุภัณฑ์", "ผู้ยืม", "ยืม – กำหนดคืน", "คืนเมื่อ", "สภาพ / สถานะ"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-black/4">
                    {returned.map((loan) => (
                      <tr key={loan.id}>
                        <td className="px-4 py-2.5"><Link href={`/assets/${loan.assetId}`} className="font-medium hover:underline">{loan.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{loan.assetNumber}</p></td>
                        <td className="px-4 py-2.5">{loan.borrowerName}<p className="text-xs text-[var(--muted)]">{loan.borrowerUnit}</p></td>
                        <td className="px-4 py-2.5 text-xs">{formatThaiDate(loan.loanedOn)} – {formatThaiDate(loan.dueOn)}</td>
                        <td className="px-4 py-2.5 text-xs">{loan.returnedOn ? formatThaiDate(loan.returnedOn) : "-"}{loan.returnedOn > loan.dueOn ? <span className="ml-1 text-rose-700">(ช้า)</span> : null}</td>
                        <td className="px-4 py-2.5 text-xs">{loan.status === "Cancelled" ? <StatusBadge tone="neutral">ยกเลิก</StatusBadge> : <StatusBadge tone={loan.returnCondition === "Damaged" ? "danger" : "success"}>{loan.returnCondition ? RETURN_CONDITION_LABELS[loan.returnCondition] : "คืนแล้ว"}</StatusBadge>}{loan.returnNote ? <p className="mt-1 text-[var(--muted)]">{loan.returnNote}</p> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
