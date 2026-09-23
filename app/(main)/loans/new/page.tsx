import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { listLoans } from "@/lib/asset-loans";
import { assetStatusLabel, assetStatusTone, isTerminalAssetStatus } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAssets } from "@/lib/assets";
import { formatThaiDate } from "@/lib/date-format";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { NewLoanForm } from "../_components/loan-forms";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const readParam = (p: Record<string, string | string[] | undefined>, key: string) => (Array.isArray(p[key]) ? p[key]?.[0] : p[key]) ?? "";

export default async function NewLoanPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "loans.manage"))) redirect("/loans");
  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const params = await searchParams;
  const assetId = Number(readParam(params, "assetId")) || 0;
  const q = readParam(params, "q");
  const breadcrumb = <nav className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]"><Link href="/loans" className="hover:text-[var(--foreground)]">ยืม-คืนครุภัณฑ์</Link><span>/</span><span>บันทึกการยืม</span></nav>;

  if (assetId) {
    const asset = await getAssetById(assetId);
    if (!asset || !canManageAssetRecord(user, asset.facilityId)) {
      return <p className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">ไม่พบทรัพย์สินหรือไม่มีสิทธิ์ — <Link href="/loans/new" className="text-[var(--primary)] hover:underline">ค้นหาใหม่</Link></p>;
    }
    const open = await listLoans({ assetId, status: "OnLoan", limit: 1 });
    const openLoan = open.rows[0];
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>{breadcrumb}<h1 className="section-title text-3xl font-semibold">บันทึกการยืมครุภัณฑ์</h1></div>
        <section className="glass-panel rounded-2xl p-6">
          <div className="mb-5 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] p-4 text-sm">
            <p className="font-semibold">{asset.assetName}</p>
            <p className="font-mono text-xs text-[var(--muted)]">{asset.assetNumber || "-"} · {asset.facilityName}</p>
            <p className="mt-1">สถานะ: <StatusBadge tone={assetStatusTone(asset.currentStatus)}>{assetStatusLabel(asset.currentStatus)}</StatusBadge></p>
          </div>
          {!open.schemaReady ? (
            <p className="text-sm text-amber-700">ยังไม่ได้เปิดใช้การยืม-คืน (ต้องรัน database/add_registry_completeness.sql)</p>
          ) : isTerminalAssetStatus(asset.currentStatus) || asset.currentStatus === "Broken" ? (
            <p className="text-sm text-amber-700">ทรัพย์สินนี้{asset.currentStatus === "Broken" ? "ชำรุด" : "จำหน่ายหรือสูญหายแล้ว"} ให้ยืมไม่ได้</p>
          ) : openLoan ? (
            <p className="text-sm">ถูกยืมอยู่โดย <b>{openLoan.borrowerName}</b> กำหนดคืน {formatThaiDate(openLoan.dueOn)} — <Link href="/loans" className="font-semibold text-[var(--primary)] underline">รับคืนก่อน</Link></p>
          ) : (
            <NewLoanForm assetId={asset.id} />
          )}
        </section>
      </div>
    );
  }

  const results = q ? await listAssets({ search: q, facilityId: facilityScopeId, limit: 50 }) : [];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <div>{breadcrumb}
        <h1 className="section-title text-3xl font-semibold">บันทึกการยืม: เลือกครุภัณฑ์</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ค้นหาด้วยชื่อ เลขครุภัณฑ์ หรือ Serial Number หรือเปิดจากหน้าครุภัณฑ์แล้วเลือก “ให้ยืม”</p>
      </div>
      <form method="GET" className="glass-panel flex gap-3 rounded-2xl p-4">
        <label htmlFor="loan-search" className="sr-only">ค้นหาครุภัณฑ์</label>
        <input id="loan-search" name="q" defaultValue={q} autoFocus placeholder="ค้นหาชื่อ / เลขครุภัณฑ์ / Serial…" className="filter-control min-w-0 flex-1" />
        <button className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]">ค้นหา</button>
      </form>
      {q && (
        <section className="glass-panel divide-y divide-black/5 overflow-hidden rounded-2xl">
          {results.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">ไม่พบครุภัณฑ์</p> : results.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium">{asset.assetName}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{asset.assetNumber} · {asset.facilityName}</p>
              </div>
              {isTerminalAssetStatus(asset.currentStatus) || asset.currentStatus === "Broken"
                ? <StatusBadge tone={assetStatusTone(asset.currentStatus)}>{assetStatusLabel(asset.currentStatus)}</StatusBadge>
                : <Link href={`/loans/new?assetId=${asset.id}`} className="whitespace-nowrap rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]">ให้ยืม →</Link>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
